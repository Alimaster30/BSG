import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import pdfParse from 'pdf-parse';
import { CATEGORY, classifyTransaction } from './classifier.js';

const columnAliases = {
  date: ['date', 'transaction date', 'txn date', 'posted date', 'posting date'],
  description: ['description', 'details', 'memo', 'narration', 'particulars'],
  account: ['account', 'account name', 'ledger', 'ledger account', 'category'],
  debit: ['debit', 'withdrawal', 'withdraw', 'outflow', 'dr'],
  credit: ['credit', 'deposit', 'inflow', 'cr'],
  amount: ['amount', 'value', 'transaction amount', 'net amount'],
  category: ['category', 'class', 'account category', 'classification'],
  type: ['type', 'transaction type', 'dc'],
};

const sourceCategoryMap = {
  asset: CATEGORY.ASSETS,
  assets: CATEGORY.ASSETS,
  liability: CATEGORY.LIABILITIES,
  liabilities: CATEGORY.LIABILITIES,
  equity: CATEGORY.EQUITY,
  revenue: CATEGORY.REVENUE,
  revenues: CATEGORY.REVENUE,
  income: CATEGORY.REVENUE,
  expense: CATEGORY.EXPENSES,
  expenses: CATEGORY.EXPENSES,
};

function getValue(row, aliases) {
  const entries = Object.entries(row);
  const match = entries.find(([key]) => aliases.includes(String(key).trim().toLowerCase()));
  return match ? match[1] : '';
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value).replace(/[,$()\s]/g, '');
  const parsed = Number(normalized);
  const isNegativeAccounting = /\(.*\)/.test(String(value));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return isNegativeAccounting ? -Math.abs(parsed) : parsed;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function getSourceCategory(row) {
  const rawCategory = String(getValue(row, columnAliases.category) || '')
    .trim()
    .toLowerCase();
  return sourceCategoryMap[rawCategory] || null;
}

function duplicatedDebitCredit(debit, credit) {
  return debit > 0 && credit > 0 && Math.abs(debit - credit) <= 0.01;
}

function chooseSingleSidedAmount(category, amount) {
  if ([CATEGORY.ASSETS, CATEGORY.EXPENSES].includes(category)) {
    return { debit: amount, credit: 0 };
  }

  return { debit: 0, credit: amount };
}

function cleanRow(row, index) {
  const amount = parseMoney(getValue(row, columnAliases.amount));
  const type = String(getValue(row, columnAliases.type)).toLowerCase();
  let debit = Math.abs(parseMoney(getValue(row, columnAliases.debit)));
  let credit = Math.abs(parseMoney(getValue(row, columnAliases.credit)));

  if (!debit && !credit && amount) {
    if (amount < 0 || type.includes('credit') || type === 'cr') {
      credit = Math.abs(amount);
    } else {
      debit = Math.abs(amount);
    }
  }

  const account = String(getValue(row, columnAliases.account) || 'Unassigned').trim();
  const description = String(getValue(row, columnAliases.description) || account || `Transaction ${index + 1}`).trim();
  const sourceCategory = getSourceCategory(row);
  const classification = sourceCategory
    ? {
        category: sourceCategory,
        confidence: 0.99,
        reason: 'Matched source category column',
      }
    : classifyTransaction({ account, description, debit, credit });
  const validationIssues = [];
  const validationNotes = [];

  if (duplicatedDebitCredit(debit, credit)) {
    const normalized = chooseSingleSidedAmount(classification.category, debit);
    debit = normalized.debit;
    credit = normalized.credit;
    validationNotes.push('duplicated amount normalized');
  }

  if (!description) validationIssues.push('missing description');
  if (!account) validationIssues.push('missing account');
  if (!debit && !credit) validationIssues.push('missing amount');
  if (debit && credit) validationIssues.push('both debit and credit');
  const validationStatus =
    validationIssues.length > 0
      ? `Review: ${validationIssues.join(', ')}`
      : validationNotes.length > 0
        ? `Ready: ${validationNotes.join(', ')}`
        : 'Ready';

  const cleaned = {
    rowNumber: index + 1,
    date: parseDate(getValue(row, columnAliases.date)),
    description,
    account,
    debit: Number(debit.toFixed(2)),
    credit: Number(credit.toFixed(2)),
    validationStatus,
  };

  return {
    ...cleaned,
    ...classification,
  };
}

function parsePdfRows(buffer) {
  return pdfParse(buffer).then((data) => {
    const lines = data.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines
      .map((line) => {
        const parts = line.split(/\s{2,}|,/).map((part) => part.trim());
        return {
          date: parts[0],
          description: parts.slice(1, -3).join(' '),
          account: parts[parts.length - 3],
          debit: parts[parts.length - 2],
          credit: parts[parts.length - 1],
        };
      })
      .filter((row) => row.description || row.account);
  });
}

async function parseExcelRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    return [];
  }

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values.slice(1).map((value) => String(value || '').trim());
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const record = {};
    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1);
      record[header] = cell.value?.text || cell.value?.result || cell.value || '';
    });
    rows.push(record);
  });

  return rows;
}

export async function parseTransactionFile(file) {
  const filename = file.originalname.toLowerCase();
  let rows = [];

  if (filename.endsWith('.csv')) {
    rows = parse(file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } else if (filename.endsWith('.xlsx')) {
    rows = await parseExcelRows(file.buffer);
  } else if (filename.endsWith('.pdf')) {
    rows = await parsePdfRows(file.buffer);
  } else {
    const error = new Error('Unsupported file type.');
    error.status = 400;
    throw error;
  }

  if (!rows.length) {
    const error = new Error('No transaction rows were found in the file.');
    error.status = 400;
    throw error;
  }

  const maxRows = Number(process.env.MAX_PARSE_ROWS || 100000);
  return rows.slice(0, maxRows).map(cleanRow);
}

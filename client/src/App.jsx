import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Home,
  Loader2,
  Search,
  ShieldCheck,
  SquarePen,
  UploadCloud,
} from 'lucide-react';

const DEFAULT_API_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : 'https://bsg-hl6m.onrender.com';

const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
const VERCEL_UPLOAD_LIMIT_MB = 4.5;

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const categories = ['ASSETS', 'LIABILITIES', 'EQUITY', 'REVENUE', 'EXPENSES'];

const statementGroups = [
  { key: 'assets', label: 'Assets' },
  { key: 'liabilities', label: 'Liabilities' },
  { key: 'equity', label: 'Equity' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'expenses', label: 'Expenses' },
];

const stepIcons = {
  upload: Home,
  review: SquarePen,
  statement: BarChart3,
  export: FolderOpen,
};

function normalizeCategory(category) {
  return String(category || '').replace(/_/g, ' ');
}

function App() {
  const [file, setFile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [uploadMeta, setUploadMeta] = useState(null);
  const [activeStep, setActiveStep] = useState('upload');
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [exporting, setExporting] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const hasResults = transactions.length > 0 && balanceSheet;
  const equation = balanceSheet?.equation;
  const heroMetric = hasResults
    ? equation?.isBalanced
      ? balanceSheet.totals.assets
      : Math.abs(equation?.difference || 0)
    : 0;
  const heroLabel = hasResults
    ? equation?.isBalanced
      ? 'Total assets'
      : 'Balance difference'
    : 'Awaiting dataset';
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTransactions = useMemo(() => {
    if (!normalizedSearch) {
      return transactions;
    }

    return transactions.filter((transaction) =>
      [
        transaction.date,
        transaction.description,
        transaction.account,
        transaction.category,
        transaction.validationStatus,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [normalizedSearch, transactions]);

  const filteredBalanceSheet = useMemo(() => {
    if (!balanceSheet || !normalizedSearch) {
      return balanceSheet;
    }

    const matches = (item) =>
      `${item.account} ${item.balance}`.toLowerCase().includes(normalizedSearch);

    return {
      ...balanceSheet,
      assets: balanceSheet.assets.filter(matches),
      liabilities: balanceSheet.liabilities.filter(matches),
      equity: balanceSheet.equity.filter(matches),
      revenue: balanceSheet.revenue.filter(matches),
      expenses: balanceSheet.expenses.filter(matches),
    };
  }, [balanceSheet, normalizedSearch]);

  const reviewStats = useMemo(() => {
    const reviewCount = transactions.filter((transaction) =>
      String(transaction.validationStatus || '').toLowerCase().startsWith('review')
    ).length;
    const normalizedCount = transactions.filter((transaction) =>
      String(transaction.validationStatus || '').toLowerCase().includes('normalized')
    ).length;

    return {
      ready: Math.max(transactions.length - reviewCount, 0),
      review: reviewCount,
      normalized: normalizedCount,
    };
  }, [transactions]);

  const steps = [
    { id: 'upload', label: 'Upload', available: true },
    { id: 'review', label: 'Review', available: hasResults },
    { id: 'statement', label: 'Balance Sheet', available: hasResults },
    { id: 'export', label: 'Export', available: hasResults },
  ];

  async function uploadFile(event) {
    event.preventDefault();
    if (!file) {
      setError('Choose a CSV, Excel, or readable PDF file first.');
      return;
    }

    const fileSizeMb = file.size / (1024 * 1024);
    if (API_URL.includes('vercel.app') && fileSizeMb > VERCEL_UPLOAD_LIMIT_MB) {
      setError(
        `This file is ${fileSizeMb.toFixed(1)} MB. Vercel serverless uploads are limited to about ${VERCEL_UPLOAD_LIMIT_MB} MB, so use the Render backend for this dataset.`
      );
      return;
    }

    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/uploads`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Upload failed.');
      }
      setTransactions(payload.transactions || []);
      setBalanceSheet(payload.balanceSheet);
      setUploadMeta(payload.upload);
      setActiveStep('review');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function recalculateBalanceSheet(nextTransactions) {
    setIsRecalculating(true);
    try {
      const response = await fetch(`${API_URL}/api/balance-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: nextTransactions }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to recalculate balance sheet.');
      }
      setBalanceSheet(payload.balanceSheet);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRecalculating(false);
    }
  }

  function updateTransactionCategory(index, category) {
    const target = filteredTransactions[index];
    if (!target) return;

    const nextTransactions = transactions.map((transaction) =>
      transaction.rowNumber === target.rowNumber
        ? { ...transaction, category, validationStatus: 'Ready: manually classified' }
        : transaction
    );
    setTransactions(nextTransactions);
    recalculateBalanceSheet(nextTransactions);
  }

  async function exportReport(format) {
    setExporting(format);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/reports/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, balanceSheet }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `Unable to export ${format.toUpperCase()}.`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = format === 'pdf' ? 'balance-sheet-report.pdf' : 'balance-sheet-report.xlsx';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting('');
    }
  }

  return (
    <main className="app-shell">
      <section className="product-bar">
        <div className="brand-lockup">
          <img className="brand-logo" src="/logo.png" alt="SmartLedger logo" />
        </div>

        <nav className="icon-nav" aria-label="Workflow steps">
          {steps.map((step) => {
            const Icon = stepIcons[step.id];
            return (
              <button
                key={step.id}
                className={`icon-step ${activeStep === step.id ? 'active' : ''}`}
                disabled={!step.available}
                onClick={() => setActiveStep(step.id)}
                title={step.label}
              >
                <Icon size={17} />
                <span>{step.label}</span>
              </button>
            );
          })}
        </nav>

        <label className="search-pill">
          <Search size={17} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={uploadMeta?.filename ? 'Search account, class, status, date...' : 'Search after upload...'}
            aria-label="Search transactions and accounts"
          />
        </label>

        <div className="status-pill">
          <ShieldCheck size={18} />
          <span>{hasResults ? `${transactions.length} rows processed` : 'Semester Project'}</span>
        </div>
      </section>

      <section className="hero-ledger">
        <div>
          <p className="eyebrow">Financial Accounting</p>
          <h1>Balance Sheet Generator</h1>
        </div>
        <div className="hero-metric">
          <strong>{currency.format(heroMetric)}</strong>
          <span>
            {heroLabel}
            {hasResults && (
              <em className={equation?.isBalanced ? 'metric-indicator positive' : 'metric-indicator warning'}>
                {equation?.isBalanced ? 'balanced' : 'review'}
              </em>
            )}
          </span>
        </div>
        <LedgerChart balanceSheet={balanceSheet} />
      </section>

      <section className="workflow-shell">
        <aside className="upload-panel">
          <form onSubmit={uploadFile} className="upload-form">
            <div>
              <p className="section-label">Source file</p>
              <h2>Import transactions</h2>
            </div>
            <label className="drop-zone">
              <UploadCloud size={32} />
              <span>{file ? file.name : 'Select CSV, Excel, or PDF'}</span>
              <input
                type="file"
                accept=".csv,.xlsx,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>

            <button className="primary-button" disabled={isUploading}>
              {isUploading ? <Loader2 className="spin" size={18} /> : <ArrowUpRight size={18} />}
              <span>{isUploading ? 'Processing' : 'Generate'}</span>
            </button>
          </form>

          {uploadMeta && (
            <div className="upload-meta">
              <span>{uploadMeta.filename}</span>
              <strong>{transactions.length} rows</strong>
            </div>
          )}

          {error && (
            <div className="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
        </aside>

        <section className="workflow-main">
          {!hasResults && activeStep !== 'upload' && (
            <section className="empty-state">
              <FileSpreadsheet size={34} />
              <h2>No dataset loaded</h2>
            </section>
          )}

          {activeStep === 'upload' && (
            <section className="focus-panel intro-panel">
              <div>
                <p className="section-label">Workflow</p>
                <h2>Upload a dataset to begin</h2>
              </div>
              <div className="metric-grid">
                <article>
                  <span>Accepted files</span>
                  <strong>CSV, XLSX, PDF</strong>
                </article>
                <article>
                  <span>Rows processed</span>
                  <strong>{transactions.length}</strong>
                </article>
                <article>
                  <span>Current status</span>
                  <strong>
                    {hasResults ? 'Generated' : 'Waiting'}
                    <em className={`inline-indicator ${hasResults ? 'active' : ''}`} />
                  </strong>
                </article>
              </div>
            </section>
          )}

          {activeStep === 'review' && hasResults && (
            <section className="focus-panel">
              <div className="panel-title-row">
                <div>
                  <p className="section-label">Review</p>
                  <h2>Parsed transactions</h2>
                </div>
                {isRecalculating && (
                  <span className="soft-status">
                    <Loader2 className="spin" size={16} />
                    Recalculating
                  </span>
                )}
              </div>

              <div className="metric-grid">
                <article>
                  <span>Ready</span>
                  <strong>
                    {reviewStats.ready}
                    <em className="inline-indicator active" />
                  </strong>
                </article>
                <article>
                  <span>Search results</span>
                  <strong>{filteredTransactions.length}</strong>
                </article>
                <article>
                  <span>Needs review</span>
                  <strong>{reviewStats.review}</strong>
                </article>
              </div>

              <TransactionTable
                transactions={filteredTransactions}
                onCategoryChange={updateTransactionCategory}
                editable
                searchQuery={searchQuery}
              />
            </section>
          )}

          {activeStep === 'statement' && hasResults && (
            <section className="focus-panel">
              <div className="panel-title-row">
                <div>
                  <p className="section-label">Generated statement</p>
                  <h2>Balance Sheet</h2>
                </div>
                {equation && (
                  <div className={`equation-badge ${equation.isBalanced ? 'balanced' : 'unbalanced'}`}>
                    {equation.isBalanced ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <strong>{equation.isBalanced ? 'Balanced' : 'Not balanced'}</strong>
                  </div>
                )}
              </div>

              {equation && (
                <div className={`equation-strip ${equation.isBalanced ? 'balanced' : 'unbalanced'}`}>
                  <span>
                    Assets {currency.format(equation.assets)} = Liabilities + Equity{' '}
                    {currency.format(equation.liabilitiesPlusEquity)}
                  </span>
                  <strong>Difference {currency.format(equation.difference)}</strong>
                </div>
              )}

              <BalanceSheetPanel balanceSheet={filteredBalanceSheet} searchQuery={searchQuery} />
            </section>
          )}

          {activeStep === 'export' && hasResults && (
            <section className="focus-panel export-panel">
              <div>
                <p className="section-label">Export</p>
                <h2>Download the final report</h2>
              </div>

              <div className="export-grid">
                <button
                  className="export-card"
                  disabled={exporting === 'pdf'}
                  onClick={() => exportReport('pdf')}
                >
                  {exporting === 'pdf' ? <Loader2 className="spin" size={22} /> : <FileText size={22} />}
                  <span>PDF report</span>
                  <Download size={18} />
                </button>
                <button
                  className="export-card"
                  disabled={exporting === 'excel'}
                  onClick={() => exportReport('excel')}
                >
                  {exporting === 'excel' ? <Loader2 className="spin" size={22} /> : <FileSpreadsheet size={22} />}
                  <span>Excel workbook</span>
                  <Download size={18} />
                </button>
              </div>

              {equation && (
                <div className={`equation-strip ${equation.isBalanced ? 'balanced' : 'unbalanced'}`}>
                  <span>
                    Assets {currency.format(equation.assets)} = Liabilities + Equity{' '}
                    {currency.format(equation.liabilitiesPlusEquity)}
                  </span>
                  <strong>Difference {currency.format(equation.difference)}</strong>
                </div>
              )}
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

function LedgerChart({ balanceSheet }) {
  const [activeIndex, setActiveIndex] = useState(25);
  const assets = balanceSheet?.totals.assets || 0;
  const liabilities = balanceSheet?.totals.liabilities || 0;
  const equity = balanceSheet?.totals.adjustedEquity || 0;
  const funding = liabilities + equity;
  const difference = assets - funding;
  const max = Math.max(assets, funding, 1);
  const assetHeight = Math.max((assets / max) * 92, 8);
  const fundingHeight = Math.max((funding / max) * 92, 8);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const bars = Array.from({ length: 42 }).map((_, index) => {
    const progress = index / 41;
    const wave = 24 + ((index * 13) % 58);
    const pulse = Math.sin(index * 0.65) * 0.08;
    const factor = 0.46 + progress * 0.54 + pulse;
    const month = months[Math.min(months.length - 1, Math.floor(progress * months.length))];

    return {
      month,
      height: wave,
      assets: assets * factor,
      funding: funding * (0.48 + progress * 0.52 - pulse / 2),
      difference: difference * factor,
    };
  });
  const activeBar = bars[activeIndex] || bars[0];

  return (
    <div className="ledger-chart" aria-label="Assets versus liabilities and equity">
      <div className="chart-lines">
        {bars.map((bar, index) => {
          const isActive = index > 8 && index < 26;
          return (
            <button
              key={index}
              className={`${isActive ? 'active' : ''} ${activeIndex === index ? 'selected' : ''}`}
              style={{ height: `${bar.height}px` }}
              type="button"
              aria-label={`${bar.month} checkpoint: ${currency.format(bar.assets)} assets`}
              onClick={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
            />
          );
        })}
      </div>
      <div
        className="chart-tooltip"
        style={{ left: `${Math.min(Math.max((activeIndex / 41) * 100, 8), 80)}%` }}
      >
        <button type="button" aria-label="Selected chart point" />
        <strong>{currency.format(activeBar?.assets || 0)}</strong>
        <span>{activeBar?.month || 'Jan'} assets checkpoint</span>
        <small>Funding {currency.format(activeBar?.funding || 0)}</small>
      </div>
      <div className="chart-compare">
        <div>
          <span style={{ height: `${assetHeight}px` }} />
          <strong>Assets</strong>
        </div>
        <div>
          <span style={{ height: `${fundingHeight}px` }} />
          <strong>Liabilities + Equity</strong>
        </div>
      </div>
    </div>
  );
}

function BalanceSheetPanel({ balanceSheet, searchQuery = '' }) {
  return (
    <section className="balance-sheet-panel">
      {searchQuery && (
        <div className="filter-note">
          Showing account breakdown matches for <strong>{searchQuery}</strong>
        </div>
      )}
      <div className="statement-grid">
        {statementGroups.map((group) => {
          const rows = balanceSheet[group.key] || [];
          return (
            <article className="statement-block" key={group.key}>
              <h3>{group.label}</h3>
              {rows.length === 0 ? (
                <div className="statement-line muted-line">
                  <span>No classified accounts</span>
                  <strong>{currency.format(0)}</strong>
                </div>
              ) : (
                rows.map((item) => (
                  <div className="statement-line" key={`${group.key}-${item.account}`}>
                    <span>{item.account}</span>
                    <strong>{currency.format(item.balance)}</strong>
                  </div>
                ))
              )}
            </article>
          );
        })}
      </div>

      <div className="totals-band">
        <div>
          <span>Total assets</span>
          <strong>{currency.format(balanceSheet.totals.assets)}</strong>
        </div>
        <div>
          <span>Total liabilities</span>
          <strong>{currency.format(balanceSheet.totals.liabilities)}</strong>
        </div>
        <div>
          <span>Adjusted equity</span>
          <strong>{currency.format(balanceSheet.totals.adjustedEquity)}</strong>
        </div>
        <div>
          <span>Net income</span>
          <strong>{currency.format(balanceSheet.totals.netIncome)}</strong>
        </div>
      </div>
    </section>
  );
}

function TransactionTable({ transactions, onCategoryChange, editable = false, searchQuery = '' }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Account</th>
            <th>Debit</th>
            <th>Credit</th>
            <th>Class</th>
            <th>Check</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan="7" className="empty-cell">
                {searchQuery ? `No transactions match "${searchQuery}".` : 'Waiting for a transaction file.'}
              </td>
            </tr>
          ) : (
            transactions.slice(0, 80).map((transaction, index) => (
              <tr
                className={String(transaction.validationStatus || '').toLowerCase().startsWith('review') ? 'review-row' : ''}
                key={`${transaction.description}-${index}`}
              >
                <td>{transaction.date || '-'}</td>
                <td>{transaction.description}</td>
                <td>{transaction.account}</td>
                <td>{transaction.debit ? currency.format(transaction.debit) : '-'}</td>
                <td>{transaction.credit ? currency.format(transaction.credit) : '-'}</td>
                <td>
                  {editable ? (
                    <select
                      className="category-select"
                      value={transaction.category}
                      onChange={(event) => onCategoryChange(index, event.target.value)}
                    >
                      {categories.map((category) => (
                        <option value={category} key={category}>
                          {normalizeCategory(category)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="category-chip">{normalizeCategory(transaction.category)}</span>
                  )}
                </td>
                <td>{transaction.validationStatus}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;

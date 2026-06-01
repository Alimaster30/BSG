import { CATEGORY } from './classifier.js';

function money(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function normalBalance(transaction) {
  const debit = Number(transaction.debit) || 0;
  const credit = Number(transaction.credit) || 0;

  if ([CATEGORY.ASSETS, CATEGORY.EXPENSES].includes(transaction.category)) {
    return debit - credit;
  }

  return credit - debit;
}

function groupByAccount(transactions, category) {
  const map = new Map();

  transactions
    .filter((transaction) => transaction.category === category)
    .forEach((transaction) => {
      const account = transaction.account || 'Unassigned';
      map.set(account, money((map.get(account) || 0) + normalBalance(transaction)));
    });

  return [...map.entries()]
    .map(([account, balance]) => ({ account, balance: money(balance) }))
    .filter((item) => Math.abs(item.balance) > 0.004)
    .sort((a, b) => a.account.localeCompare(b.account));
}

function sum(items) {
  return money(items.reduce((total, item) => total + item.balance, 0));
}

export function generateBalanceSheet(transactions) {
  const assets = groupByAccount(transactions, CATEGORY.ASSETS);
  const liabilities = groupByAccount(transactions, CATEGORY.LIABILITIES);
  const equity = groupByAccount(transactions, CATEGORY.EQUITY);
  const revenue = groupByAccount(transactions, CATEGORY.REVENUE);
  const expenses = groupByAccount(transactions, CATEGORY.EXPENSES);

  const totals = {
    assets: sum(assets),
    liabilities: sum(liabilities),
    equity: sum(equity),
    revenue: sum(revenue),
    expenses: sum(expenses),
  };
  totals.netIncome = money(totals.revenue - totals.expenses);
  totals.adjustedEquity = money(totals.equity + totals.netIncome);

  const liabilitiesPlusEquity = money(totals.liabilities + totals.adjustedEquity);
  const difference = money(totals.assets - liabilitiesPlusEquity);

  return {
    assets,
    liabilities,
    equity,
    revenue,
    expenses,
    totals,
    equation: {
      assets: totals.assets,
      liabilitiesPlusEquity,
      difference,
      isBalanced: Math.abs(difference) <= 0.01,
    },
  };
}

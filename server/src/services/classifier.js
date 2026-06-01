export const CATEGORY = {
  ASSETS: 'ASSETS',
  LIABILITIES: 'LIABILITIES',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSES: 'EXPENSES',
};

const keywordRules = [
  {
    category: CATEGORY.ASSETS,
    confidence: 0.95,
    words: ['cash', 'bank', 'inventory', 'receivable', 'asset', 'equipment', 'furniture', 'vehicle', 'building', 'land', 'prepaid'],
  },
  {
    category: CATEGORY.LIABILITIES,
    confidence: 0.95,
    words: ['payable', 'loan', 'liability', 'creditor', 'mortgage', 'note payable', 'tax payable', 'unearned'],
  },
  {
    category: CATEGORY.EQUITY,
    confidence: 0.92,
    words: ['capital', 'equity', 'owner', 'drawing', 'drawings', 'retained earnings', 'common stock'],
  },
  {
    category: CATEGORY.REVENUE,
    confidence: 0.94,
    words: ['revenue', 'sales', 'income', 'service fees', 'fees earned', 'commission earned'],
  },
  {
    category: CATEGORY.EXPENSES,
    confidence: 0.94,
    words: ['expense', 'rent', 'salary', 'wages', 'utilities', 'insurance', 'advertising', 'supplies', 'depreciation', 'maintenance'],
  },
];

export function classifyTransaction(transaction) {
  const haystack = `${transaction.account} ${transaction.description}`.toLowerCase();
  const matchedRule = keywordRules.find((rule) => rule.words.some((word) => haystack.includes(word)));

  if (matchedRule) {
    return {
      category: matchedRule.category,
      confidence: matchedRule.confidence,
      reason: 'Matched accounting keyword',
    };
  }

  // Debit-normal fallback keeps unknown rows inside the five required classes.
  if (Number(transaction.debit) > Number(transaction.credit)) {
    return {
      category: CATEGORY.ASSETS,
      confidence: 0.42,
      reason: 'Debit-normal fallback',
    };
  }

  return {
    category: CATEGORY.LIABILITIES,
    confidence: 0.42,
    reason: 'Credit-normal fallback',
  };
}

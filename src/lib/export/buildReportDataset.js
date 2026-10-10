/**
 * Helper to verify transaction is live and posted (not deleted or pending)
 */
export function isLiveTransaction(tx) {
  return tx && !tx.deleted_at && tx.status !== 'pending';
}

/**
 * Builds a normalized, authoritative report dataset from filtered transactions
 * preserving split lines, multi-currency values, and applied filter metadata.
 */
export function buildReportDataset(transactions = [], options = {}) {
  const {
    workspace = {},
    user = null,
    profile = {},
    startDate = '',
    endDate = '',
    appliedFilters = {},
    categories = [],
    accounts = [],
    tags = [],
    baseCurrency = workspace?.base_currency || 'USD',
  } = options;

  // 1. Compile Human-Readable Applied Filters
  const filterList = [];

  if (startDate && endDate) {
    filterList.push({ key: 'period', label: 'Date Range', value: `${startDate} to ${endDate}` });
  }

  if (appliedFilters.type && appliedFilters.type !== 'all') {
    const typeLabel =
      appliedFilters.type === 'expense'
        ? 'Expenses only'
        : appliedFilters.type === 'income'
        ? 'Income only'
        : appliedFilters.type === 'transfer'
        ? 'Transfers only'
        : appliedFilters.type;
    filterList.push({ key: 'type', label: 'Transaction Type', value: typeLabel });
  }

  if (appliedFilters.category && appliedFilters.category !== 'all') {
    const matchedCat = categories.find((c) => c.id === appliedFilters.category || c.name === appliedFilters.category);
    filterList.push({
      key: 'category',
      label: 'Category',
      value: matchedCat ? `${matchedCat.icon || ''} ${matchedCat.name}`.trim() : appliedFilters.category,
    });
  }

  if (appliedFilters.account && appliedFilters.account !== 'all') {
    const matchedAcc = accounts.find((a) => a.id === appliedFilters.account || a.name === appliedFilters.account);
    filterList.push({
      key: 'account',
      label: 'Account',
      value: matchedAcc ? `${matchedAcc.name} (${matchedAcc.currency || baseCurrency})` : appliedFilters.account,
    });
  }

  if (appliedFilters.tag && appliedFilters.tag !== 'all') {
    const matchedTag = tags.find((t) => t.id === appliedFilters.tag || t.name === appliedFilters.tag);
    filterList.push({
      key: 'tag',
      label: 'Tag',
      value: matchedTag ? matchedTag.name : appliedFilters.tag,
    });
  }

  if (appliedFilters.search && appliedFilters.search.trim()) {
    filterList.push({ key: 'search', label: 'Search Query', value: `"${appliedFilters.search.trim()}"` });
  }

  // 2. Flatten Transactions into Itemized Ledger Rows
  const rows = [];
  const catTotals = {};
  const accTotals = {};
  const monthTotals = {};

  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransfers = 0;

  for (const tx of transactions) {
    const isLive = isLiveTransaction(tx);
    const lines = Array.isArray(tx.lines) && tx.lines.length > 0 ? tx.lines : [null];

    const txDate = tx.date || '';
    const monthKey = txDate.slice(0, 7) || 'Unknown';
    if (!monthTotals[monthKey]) {
      monthTotals[monthKey] = { monthKey, income: 0, expense: 0, net: 0 };
    }

    lines.forEach((line, lineIndex) => {
      const lineAccId = line?.account_id || line?.accountId || tx.account_id || tx.accountId;
      const matchedAcc = accounts.find((a) => a.id === lineAccId) || line?.account || null;
      const accName = matchedAcc?.name || line?.account?.name || 'Primary Account';
      const accCurr = matchedAcc?.currency || line?.currency || tx.currency || baseCurrency;

      const lineCatId = line?.category_id || line?.categoryId || tx.category_id || tx.categoryId;
      const matchedCat = categories.find((c) => c.id === lineCatId) || line?.category || null;
      const catName = matchedCat?.name || line?.category?.name || tx.category || (tx.type === 'transfer' ? 'Transfer' : 'General');
      const catIcon = matchedCat?.icon || line?.category?.icon || '';

      const direction = line?.direction || (tx.type === 'income' ? 'in' : 'out');
      const origAmount = parseFloat(line?.amount ?? tx.amount ?? 0);
      const baseAmount = parseFloat(line?.base_amount ?? line?.amount ?? tx.amount ?? 0);

      const isDebit = direction === 'out';
      const debitVal = isDebit ? baseAmount : 0;
      const creditVal = !isDebit ? baseAmount : 0;
      const netVal = !isDebit ? baseAmount : -baseAmount;

      const tagsStr = (tx.tags || [])
        .map((tg) => tg.tag?.name || tg.name || tg)
        .filter(Boolean)
        .join(', ');

      // Groupings
      if (isLive) {
        if (tx.type === 'income') {
          totalIncome += baseAmount;
          monthTotals[monthKey].income += baseAmount;
        } else if (tx.type === 'expense' || line?.isFee) {
          totalExpense += baseAmount;
          monthTotals[monthKey].expense += baseAmount;
          catTotals[catName] = (catTotals[catName] || 0) + baseAmount;
        } else if (tx.type === 'transfer') {
          totalTransfers += baseAmount;
        }

        monthTotals[monthKey].net = monthTotals[monthKey].income - monthTotals[monthKey].expense;

        // Account flow
        if (!accTotals[accName]) {
          accTotals[accName] = { name: accName, currency: accCurr, inTotal: 0, outTotal: 0, net: 0 };
        }
        if (direction === 'in') accTotals[accName].inTotal += baseAmount;
        else accTotals[accName].outTotal += baseAmount;
        accTotals[accName].net = accTotals[accName].inTotal - accTotals[accName].outTotal;
      }

      rows.push({
        id: `${tx.id}-${line?.id || lineIndex}`,
        txId: tx.id,
        date: txDate,
        type: tx.type || 'expense',
        status: tx.status || 'cleared',
        payee: tx.payee_name || tx.title || 'Unlabeled Transaction',
        description: line?.description || tx.notes || '',
        category: catName,
        categoryIcon: catIcon,
        account: accName,
        accountCurrency: accCurr,
        direction,
        originalAmount: origAmount,
        originalCurrency: accCurr,
        baseAmount,
        baseCurrency,
        debit: debitVal,
        credit: creditVal,
        netAmount: netVal,
        isFee: Boolean(line?.isFee),
        isForeign: Boolean(tx.is_foreign),
        originWorkspace: tx.origin_workspace_name || '',
        tags: tagsStr,
        notes: tx.notes || '',
      });
    });
  }

  const netCashflow = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netCashflow / totalIncome) * 100) : 0;

  // Compile byCategory list sorted descending
  const byCategory = Object.entries(catTotals)
    .map(([name, total]) => ({
      name,
      total,
      percent: totalExpense > 0 ? Math.round((total / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const byAccount = Object.values(accTotals).sort((a, b) => b.outTotal - a.outTotal);

  const byMonth = Object.values(monthTotals).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  return {
    meta: {
      appName: 'Expense Pro',
      title: 'Financial Activity & Ledger Report',
      workspaceName: workspace?.name || 'Personal Space',
      generatedAt: new Date().toISOString(),
      generatedBy: profile?.fullName || user?.email || 'User',
      baseCurrency,
      period: startDate && endDate ? `${startDate} to ${endDate}` : 'All Time',
    },
    filters: filterList,
    summary: {
      totalIncome,
      totalExpense,
      totalTransfers,
      netCashflow,
      savingsRate,
      transactionCount: transactions.length,
      lineCount: rows.length,
    },
    rows,
    byCategory,
    byAccount,
    byMonth,
  };
}

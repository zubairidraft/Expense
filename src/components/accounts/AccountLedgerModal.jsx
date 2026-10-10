import { useState, useMemo } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import Icon from '../ui/Icon';
import { dec, toNum, isLiveTransaction } from '../../lib/money';

export default function AccountLedgerModal({
  isOpen,
  onClose,
  account,
  onOpenTransfer,
  onEditTransfer,
}) {
  const { transactions, deleteTransaction } = useTransactions();
  const { currentWorkspace } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'in' | 'out' | 'transfer'

  const baseCurrency = currentWorkspace?.base_currency || 'USD';
  const isAsset = (account?.nature || 'asset') === 'asset';

  // Compute chronologically sorted lines with running balance
  const ledgerEntries = useMemo(() => {
    if (!account) return [];

    const openingDec = dec(account.opening_balance || '0');
    let running = openingDec;

    // 1. Gather all live transactions affecting this account
    const relevantTxs = transactions
      .filter((tx) => isLiveTransaction(tx))
      .filter((tx) => (tx.lines || []).some((l) => (l.account_id || l.accountId) === account.id));

    // 2. Sort chronologically ascending to calculate running balance
    const sortedAsc = [...relevantTxs].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

    // 3. Process each line touching this account
    const linesWithBalance = [];

    for (const tx of sortedAsc) {
      const isTransfer = tx.type === 'transfer';
      const myLines = (tx.lines || []).filter((l) => (l.account_id || l.accountId) === account.id);

      for (const line of myLines) {
        const amt = dec(line.amount);
        const isIn = line.direction === 'in';

        // Asset: in adds, out subtracts. Liability (debt): out adds, in subtracts.
        running = isAsset === isIn ? running.plus(amt) : running.minus(amt);

        // Find counterpart account for transfers
        let counterpartName = 'Other Account';
        if (isTransfer) {
          const counterpartLine = (tx.lines || []).find((l) => (l.account_id || l.accountId) !== account.id);
          if (counterpartLine) {
            counterpartName = counterpartLine.account?.name || counterpartLine.description?.replace(/Transfer (to|from) /, '') || 'Other Account';
          }
        }

        let displayTitle = tx.payee_name || tx.title || 'Ledger Entry';
        if (isTransfer) {
          if (line.isFee) {
            displayTitle = '⚡ Transfer Fee / Bank Charge';
          } else if (isIn) {
            displayTitle = `⇄ Transfer from ${counterpartName}`;
          } else {
            displayTitle = `⇄ Transfer to ${counterpartName}`;
          }
        }

        linesWithBalance.push({
          id: `${tx.id}-${line.id || Math.random()}`,
          txId: tx.id,
          rawTx: tx,
          date: tx.date,
          status: tx.status,
          isTransfer,
          isFee: Boolean(line.isFee),
          direction: line.direction,
          amount: line.amount,
          currency: line.currency || account.currency || baseCurrency,
          displayTitle,
          notes: tx.notes || line.description || '',
          categoryName: line.category?.name || tx.category || '',
          categoryIcon: line.category?.icon || (isIn ? '💰' : '💳'),
          runningBalance: running.toFixed(2),
          isForeign: Boolean(tx.is_foreign),
        });
      }
    }

    // 4. Return reverse-chronological (newest first) for user viewing
    return linesWithBalance.reverse();
  }, [account, transactions, isAsset, baseCurrency]);

  if (!isOpen || !account) return null;

  // Filtered by search and direction
  const filteredEntries = ledgerEntries.filter((item) => {
    const matchesSearch =
      item.displayTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.categoryName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'in') return item.direction === 'in';
    if (filterType === 'out') return item.direction === 'out';
    if (filterType === 'transfer') return item.isTransfer;
    return true;
  });

  // Aggregate totals
  const totalIn = ledgerEntries
    .filter((e) => e.direction === 'in')
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  const totalOut = ledgerEntries
    .filter((e) => e.direction === 'out')
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  const handleDelete = (txId) => {
    if (window.confirm('Delete this transaction from the ledger? This will reverse its impact on all affected accounts.')) {
      deleteTransaction(txId);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content glass-card account-ledger-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '780px', width: '100%', padding: '1.75rem' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'var(--md-primary-container)',
                color: 'var(--md-on-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                flexShrink: 0,
              }}
            >
              {account.icon || '🏦'}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 className="modal-title" style={{ fontSize: '1.3rem', margin: 0 }}>
                  {account.name} Ledger
                </h2>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    textTransform: 'capitalize',
                    background: 'rgba(var(--md-primary-rgb), 0.12)',
                    color: 'var(--md-primary)',
                    fontWeight: 600,
                  }}
                >
                  {account.type} · {account.nature}
                </span>
                {account.is_shared && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>🔗 Shared</span>
                )}
              </div>
              <p className="modal-subtitle" style={{ margin: '0.2rem 0 0' }}>
                Running balance statement & chronological double-entry audit feed
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {onOpenTransfer && (
              <button
                type="button"
                className="submit-btn primary-glow"
                onClick={() => {
                  onClose();
                  onOpenTransfer({ fromAccountId: account.id });
                }}
                style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
              >
                <span>⇄</span> Transfer
              </button>
            )}
            <button className="modal-close-btn" onClick={onClose} aria-label="Close ledger">
              ✕
            </button>
          </div>
        </div>

        {/* Aggregates Summary Ribbon */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.65rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--bg-main, rgba(0,0,0,0.06))', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Current Balance</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem' }}>
              <MoneyDisplay amount={account.balance} currencyCode={account.currency || baseCurrency} />
            </div>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--bg-main, rgba(0,0,0,0.06))', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Opening Balance</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
              <MoneyDisplay amount={account.opening_balance || 0} currencyCode={account.currency || baseCurrency} />
            </div>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(var(--md-success-rgb), 0.06)', border: '1px solid rgba(var(--md-success-rgb), 0.2)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--md-success)', textTransform: 'uppercase', fontWeight: 600 }}>Total Inflows</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--md-success)' }}>
              +<MoneyDisplay amount={totalIn} currencyCode={account.currency || baseCurrency} />
            </div>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(var(--md-error-rgb), 0.06)', border: '1px solid rgba(var(--md-error-rgb), 0.2)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--md-error)', textTransform: 'uppercase', fontWeight: 600 }}>Total Outflows</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--md-error)' }}>
              -<MoneyDisplay amount={totalOut} currencyCode={account.currency || baseCurrency} />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search in this account's entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              className={`preset-chip ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
              style={filterType === 'all' ? { background: 'var(--md-primary)', color: '#ffffff' } : undefined}
            >
              All ({ledgerEntries.length})
            </button>
            <button
              type="button"
              className={`preset-chip ${filterType === 'transfer' ? 'active' : ''}`}
              onClick={() => setFilterType('transfer')}
              style={filterType === 'transfer' ? { background: 'var(--md-primary)', color: '#ffffff' } : undefined}
            >
              ⇄ Transfers ({ledgerEntries.filter((e) => e.isTransfer).length})
            </button>
            <button
              type="button"
              className={`preset-chip ${filterType === 'in' ? 'active' : ''}`}
              onClick={() => setFilterType('in')}
              style={filterType === 'in' ? { background: 'var(--md-primary)', color: '#ffffff' } : undefined}
            >
              Inflows ({ledgerEntries.filter((e) => e.direction === 'in').length})
            </button>
            <button
              type="button"
              className={`preset-chip ${filterType === 'out' ? 'active' : ''}`}
              onClick={() => setFilterType('out')}
              style={filterType === 'out' ? { background: 'var(--md-primary)', color: '#ffffff' } : undefined}
            >
              Outflows ({ledgerEntries.filter((e) => e.direction === 'out').length})
            </button>
          </div>
        </div>

        {/* Chronological Table with Running Balance */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-main, rgba(0,0,0,0.06))', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.65rem 0.85rem' }}>Date</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Transaction / Description</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Running Balance</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No transactions recorded for this account.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle, rgba(var(--md-on-surface-rgb), 0.06))',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--md-on-surface-rgb), 0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {item.date}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>
                          {item.isTransfer ? '⇄' : item.categoryIcon}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.displayTitle}
                          </div>
                          {item.notes && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>
                      <span style={{ color: item.direction === 'in' ? 'var(--md-success)' : 'var(--md-error)' }}>
                        {item.direction === 'in' ? '+' : '-'}
                        <MoneyDisplay amount={item.amount} currencyCode={item.currency} />
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <MoneyDisplay amount={item.runningBalance} currencyCode={account.currency || baseCurrency} />
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                        {item.isTransfer && onEditTransfer && !item.isForeign && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onEditTransfer(item.rawTx);
                            }}
                            title="Edit this transfer"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.88rem',
                              padding: '0.2rem',
                            }}
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={item.isForeign}
                          onClick={() => handleDelete(item.txId)}
                          title={item.isForeign ? 'Foreign entry (read only)' : 'Delete transaction'}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: item.isForeign ? 'not-allowed' : 'pointer',
                            opacity: item.isForeign ? 0.3 : 1,
                            fontSize: '0.88rem',
                            padding: '0.2rem',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}

              {/* Baseline Row: Opening Balance */}
              <tr style={{ background: 'var(--bg-main, rgba(0,0,0,0.04))', fontWeight: 600 }}>
                <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>Baseline</td>
                <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>
                  <span>🏁 Opening Balance Setup</span>
                </td>
                <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  —
                </td>
                <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <MoneyDisplay amount={account.opening_balance || 0} currencyCode={account.currency || baseCurrency} />
                </td>
                <td style={{ padding: '0.65rem 0.85rem' }}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ minWidth: '90px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

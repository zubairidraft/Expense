import { useState } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';

export default function AccountsView({ onOpenCreateAccount }) {
  const { accounts, totalAssets, totalLiabilities, netWorth, archiveAccount } = useAccounts();
  const { currentWorkspace } = useWorkspace();
  const [filterNature, setFilterNature] = useState('all'); // 'all' | 'asset' | 'liability'

  const baseCurrency = currentWorkspace?.base_currency || 'USD';

  const filteredAccounts = accounts.filter((a) => {
    if (filterNature === 'all') return true;
    return a.nature === filterNature;
  });

  const handleDelete = (e, id, name) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to archive account "${name}"?`)) {
      archiveAccount(id);
    }
  };

  return (
    <div className="accounts-view-container">
      {/* Overview Aggregates Banner */}
      <section className="stats-grid" aria-label="Accounts Net Worth Overview">
        <StatCard
          title="Net Worth"
          icon="💎"
          variant="balance"
          value={<MoneyDisplay amount={netWorth} currencyCode={baseCurrency} />}
          meta="Total Assets − Total Liabilities"
        />

        <StatCard
          title="Liquid Assets"
          icon="🏦"
          variant="income"
          value={<MoneyDisplay amount={totalAssets} currencyCode={baseCurrency} type="income" />}
          meta={`${accounts.filter((a) => a.nature === 'asset').length} asset accounts`}
        />

        <StatCard
          title="Total Liabilities"
          icon="💳"
          variant="expense"
          value={<MoneyDisplay amount={totalLiabilities} currencyCode={baseCurrency} type="expense" />}
          meta={`${accounts.filter((a) => a.nature === 'liability').length} liability obligations`}
        />
      </section>

      {/* Action Header & Filtering */}
      <div className="accounts-action-bar">
        <div className="accounts-filter-group">
          <button
            className={`acc-filter-btn ${filterNature === 'all' ? 'active' : ''}`}
            onClick={() => setFilterNature('all')}
          >
            All Accounts ({accounts.length})
          </button>
          <button
            className={`acc-filter-btn ${filterNature === 'asset' ? 'active' : ''}`}
            onClick={() => setFilterNature('asset')}
          >
            Assets ({accounts.filter((a) => a.nature === 'asset').length})
          </button>
          <button
            className={`acc-filter-btn ${filterNature === 'liability' ? 'active' : ''}`}
            onClick={() => setFilterNature('liability')}
          >
            Liabilities ({accounts.filter((a) => a.nature === 'liability').length})
          </button>
        </div>

        <button
          onClick={onOpenCreateAccount}
          className="submit-btn primary-glow add-acc-btn"
        >
          <span>➕</span> Add Account
        </button>
      </div>

      {/* Accounts Grid */}
      <div className="accounts-grid">
        {filteredAccounts.length === 0 ? (
          <div className="empty-state panel full-width">
            <span>🏦</span>
            <p>No accounts found in this category.</p>
            <button
              onClick={onOpenCreateAccount}
              className="submit-btn primary-glow"
              style={{ marginTop: '1rem', width: 'auto' }}
            >
              Create Your First Account
            </button>
          </div>
        ) : (
          filteredAccounts.map((acc) => {
            const isAsset = acc.nature === 'asset';
            const bal = parseFloat(acc.opening_balance || '0');
            const limit = acc.credit_limit ? parseFloat(acc.credit_limit) : null;
            const utilPercent = limit && limit > 0 ? Math.min(Math.round((bal / limit) * 100), 100) : null;

            return (
              <div key={acc.id} className="account-card glass-card">
                <div className="acc-card-header">
                  <div className="acc-card-brand">
                    <span className="acc-icon-bubble">{acc.icon || (isAsset ? '🏦' : '💳')}</span>
                    <div>
                      <h3 className="acc-card-name">{acc.name}</h3>
                      <span className="acc-card-type">
                        {acc.type.toUpperCase()} · {acc.visibility === 'private' ? '🔒 Private' : '🌐 Shared'}
                      </span>
                    </div>
                  </div>
                  <button
                    className="tx-delete-btn"
                    onClick={(e) => handleDelete(e, acc.id, acc.name)}
                    title="Archive Account"
                  >
                    🗑️
                  </button>
                </div>

                <div className="acc-card-body">
                  <div className="acc-balance-block">
                    <span className="acc-bal-label">Current Balance</span>
                    <MoneyDisplay
                      amount={bal}
                      currencyCode={acc.currency || baseCurrency}
                      type={isAsset ? 'income' : 'expense'}
                      className="acc-bal-val"
                    />
                  </div>

                  {limit && (
                    <div className="acc-limit-block">
                      <div className="acc-limit-meta">
                        <span>Limit: <MoneyDisplay amount={limit} currencyCode={acc.currency || baseCurrency} /></span>
                        <span>{utilPercent}% used</span>
                      </div>
                      <div className="cat-bar-track">
                        <div
                          className="cat-bar-fill"
                          style={{
                            width: `${utilPercent}%`,
                            background: utilPercent > 80 ? 'var(--expense-color)' : 'var(--accent-gradient)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="acc-card-footer">
                  <span className={`nature-badge ${acc.nature}`}>
                    {acc.nature.toUpperCase()}
                  </span>
                  <span className="acc-currency-tag">{acc.currency || baseCurrency}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

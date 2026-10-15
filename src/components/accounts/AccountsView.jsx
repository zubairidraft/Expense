import { useState } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';
import ShareAccountModal from './ShareAccountModal';
import AccountLedgerModal from './AccountLedgerModal';
import SharingActivityPanel from './SharingActivityPanel';

export default function AccountsView({ onOpenCreateAccount, onOpenTransfer, onEditTransfer }) {
  const { accounts, accountShares = [], totalAssets, totalLiabilities, netWorth, archiveAccount } = useAccounts();
  const { currentWorkspace } = useWorkspace();
  const [filterNature, setFilterNature] = useState('all'); // 'all' | 'asset' | 'liability'
  const [sharingAccount, setSharingAccount] = useState(null);
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState(null);

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
            const bal = parseFloat(acc.balance ?? acc.opening_balance ?? '0');
            const limit = acc.credit_limit ? parseFloat(acc.credit_limit) : null;
            const utilPercent = limit && limit > 0 ? Math.min(Math.round((bal / limit) * 100), 100) : null;

            return (
              <div
                key={acc.id}
                className="account-card glass-card"
                onClick={() => setSelectedLedgerAccount(acc)}
                style={{ cursor: 'pointer' }}
                title="Click to view detailed account ledger & transactions"
              >
                <div className="acc-card-header">
                  <div className="acc-card-brand">
                    <span className="acc-icon-bubble">{acc.icon || (isAsset ? '🏦' : '💳')}</span>
                    <div>
                      <h3 className="acc-card-name">{acc.name}</h3>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.2rem' }}>
                        <span className="acc-card-type">
                          {acc.type.toUpperCase()} · {acc.visibility === 'private' ? '🔒 Private' : '🌐 Shared'}
                        </span>

                        {acc.is_shared ? (
                          <span
                            className="share-badge incoming"
                            title={`Shared from home workspace: ${acc.home_workspace_name || 'Home Workspace'}`}
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '6px',
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#2563eb',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            🔗 Shared from {acc.home_workspace_name || 'Home Workspace'}
                          </span>
                        ) : (
                          (() => {
                            const activeShares = accountShares.filter(
                              (s) => s.account_id === acc.id && s.status === 'active'
                            );
                            if (activeShares.length > 0) {
                              return (
                                <span
                                  className="share-badge outgoing"
                                  title={`Shared with ${activeShares.length} workspace(s)`}
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '6px',
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    color: '#059669',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                >
                                  🔗 Shared ({activeShares.length})
                                </span>
                              );
                            }
                            return null;
                          })()
                        )}

                        {acc.is_shared && acc.can_post === false && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#dc2626',
                              fontWeight: 500,
                            }}
                            title="Posting disabled by home workspace"
                          >
                            Read Only
                          </span>
                        )}
                        {acc.is_shared && acc.count_in_net_worth && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: 'rgba(168, 85, 247, 0.1)',
                              color: '#7c3aed',
                              fontWeight: 500,
                            }}
                            title="Included in this workspace's Net Worth calculation"
                          >
                            In Net Worth
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {!acc.is_shared && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSharingAccount(acc);
                        }}
                        title="Share account with other workspaces"
                        style={{
                          background: 'rgba(var(--md-on-surface-rgb), 0.05)',
                          border: '1px solid rgba(var(--md-on-surface-rgb), 0.12)',
                          borderRadius: '6px',
                          padding: '0.35rem 0.6rem',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: 'var(--md-on-surface)',
                          fontWeight: 500,
                        }}
                      >
                        <span>🔗</span> Share
                      </button>
                    )}

                    <button
                      className="tx-delete-btn"
                      disabled={acc.is_shared}
                      onClick={(e) => {
                        if (acc.is_shared) return;
                        handleDelete(e, acc.id, acc.name);
                      }}
                      title={acc.is_shared ? "Sirf home workspace se archive ho sakta hai" : "Archive Account"}
                      style={acc.is_shared ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                    >
                      🗑️
                    </button>
                  </div>
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

                <div
                  className="acc-card-footer"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(var(--md-on-surface-rgb), 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className={`nature-badge ${acc.nature}`}>
                      {acc.nature.toUpperCase()}
                    </span>
                    <span className="acc-currency-tag">{acc.currency || baseCurrency}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLedgerAccount(acc);
                      }}
                      title="View account ledger and transaction history"
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(var(--md-primary-rgb, 99, 102, 241), 0.08)',
                        color: 'var(--md-primary)',
                        fontWeight: 600,
                        border: '1px solid rgba(var(--md-primary-rgb, 99, 102, 241), 0.2)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <span>📜</span> Ledger
                    </button>

                    <button
                      type="button"
                      className="btn-text"
                      disabled={acc.is_shared && acc.can_post === false}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (acc.is_shared && acc.can_post === false) return;
                        onOpenTransfer?.({ fromAccountId: acc.id });
                      }}
                      title="Transfer money from or to this account"
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        background: 'var(--md-primary)',
                        color: '#ffffff',
                        fontWeight: 600,
                        border: 'none',
                        cursor: acc.is_shared && acc.can_post === false ? 'not-allowed' : 'pointer',
                        opacity: acc.is_shared && acc.can_post === false ? 0.5 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <span>⇄</span> Transfer
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <SharingActivityPanel />

      {/* Share Account Modal */}
      <ShareAccountModal
        account={sharingAccount}
        isOpen={Boolean(sharingAccount)}
        onClose={() => setSharingAccount(null)}
      />

      {/* Account Ledger Running Balance Modal */}
      <AccountLedgerModal
        account={selectedLedgerAccount}
        isOpen={Boolean(selectedLedgerAccount)}
        onClose={() => setSelectedLedgerAccount(null)}
        onOpenTransfer={onOpenTransfer}
        onEditTransfer={onEditTransfer}
      />
    </div>
  );
}

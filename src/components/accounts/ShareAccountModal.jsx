import { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAccounts } from '../../context/AccountContext';
import Icon from '../ui/Icon';

export default function ShareAccountModal({ isOpen, onClose, account }) {
  const { workspaces, currentWorkspace } = useWorkspace();
  const { shareAccount, revokeAccountShare, fetchAccountShares, accountShares = [] } = useAccounts();

  const [targetWorkspaceId, setTargetWorkspaceId] = useState('');
  const [canPost, setCanPost] = useState(true);
  const [detailLevel, setDetailLevel] = useState('summary'); // 'summary' (default) | 'full'
  const [countInNetWorth, setCountInNetWorth] = useState(false); // default: false
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Workspaces other than the home workspace of this account
  const eligibleWorkspaces = workspaces.filter(
    (w) => w.id !== (account?.workspace_id || currentWorkspace?.id)
  );

  useEffect(() => {
    if (account?.id && fetchAccountShares) {
      fetchAccountShares(account.id);
    }
  }, [account?.id, fetchAccountShares]);

  useEffect(() => {
    if (eligibleWorkspaces.length > 0 && !targetWorkspaceId) {
      setTargetWorkspaceId(eligibleWorkspaces[0].id);
    }
  }, [eligibleWorkspaces, targetWorkspaceId]);

  if (!isOpen || !account) return null;

  // Active shares for this specific account
  const currentShares = (accountShares || []).filter(
    (s) => s.account_id === account.id && s.status === 'active'
  );

  const handleShare = async (e) => {
    e.preventDefault();
    if (!targetWorkspaceId) {
      setErrorMsg('Please select a target workspace.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await shareAccount({
        accountId: account.id,
        targetWorkspaceId,
        canPost,
        detailLevel,
        countInNetWorth,
      });

      if (res?.error) {
        const msg = res.error.message || '';
        if (msg.includes('schema cache') || msg.includes('share_account')) {
          setErrorMsg('Database migration required: Migration 020 (cross_workspace_account_sharing.sql) needs to be executed in your Supabase SQL Editor.');
        } else {
          setErrorMsg(msg || 'Failed to share account.');
        }
      } else {
        setSuccessMsg('Account successfully shared!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('schema cache') || msg.includes('share_account')) {
        setErrorMsg('Database migration required: Migration 020 (cross_workspace_account_sharing.sql) needs to be executed in your Supabase SQL Editor.');
      } else {
        setErrorMsg(msg || 'Failed to share account.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (targetWsId, wsName) => {
    if (!window.confirm(`Revoke access for workspace "${wsName}"? New transactions will be blocked, but existing ledger history remains intact.`)) {
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await revokeAccountShare(account.id, targetWsId);
      setSuccessMsg(`Share revoked for ${wsName}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to revoke share.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content share-account-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="handshake" size={24} />
              Share Account Across Workspaces
            </h2>
            <p className="modal-subtitle">
              Synchronize “{account.name}” ({account.currency}) with another workspace without duplicating balances.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="modal-error-banner" role="alert" style={{ marginBottom: '1rem' }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="quick-add-success-banner" style={{ marginBottom: '1rem', marginTop: 0 }}>
            {successMsg}
          </div>
        )}

        {/* Existing Active Shares */}
        {currentShares.length > 0 && (
          <div style={{ marginBottom: '1.5rem', background: 'rgba(var(--md-on-surface-rgb), 0.04)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Workspace Shares ({currentShares.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {currentShares.map((s) => {
                const targetWs = workspaces.find((w) => w.id === s.workspace_id || w.id === s.target_workspace_id);
                const wsName = s.target_workspace_name || targetWs?.name || 'Workspace';
                return (
                  <div
                    key={s.id || s.workspace_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(var(--md-surface-rgb), 0.7)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--md-on-surface)' }}>
                        🏢 {wsName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {s.can_post ? '✓ Can Post' : '🔒 View Only'} · Detail: {s.detail_level === 'full' ? 'Full Payee/Notes' : 'Summary Masked'} · {s.count_in_net_worth ? 'In Net Worth' : 'Excluded from Net Worth'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: 'var(--md-error)' }}
                      onClick={() => handleRevoke(s.workspace_id || s.target_workspace_id, wsName)}
                      disabled={submitting}
                      title="Revoke access. Historical transactions will remain preserved."
                    >
                      Revoke
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Share with New Workspace Form */}
        <form onSubmit={handleShare} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="input-label" htmlFor="target-workspace">Target Workspace</label>
            {eligibleWorkspaces.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                No other workspaces available. Create a new workspace first under Workspace Switcher.
              </p>
            ) : (
              <select
                id="target-workspace"
                className="select-field"
                value={targetWorkspaceId}
                onChange={(e) => setTargetWorkspaceId(e.target.value)}
                style={{ width: '100%' }}
                required
              >
                {eligibleWorkspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.type === 'business' ? '🏢' : w.type === 'household' ? '🏠' : '👤'} {w.name} ({w.base_currency})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Permissions & Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'rgba(var(--md-on-surface-rgb), 0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={canPost}
                onChange={(e) => setCanPost(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--md-primary)' }}
              />
              <div>
                <strong>Allow posting transactions</strong>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Target workspace can deduct expenses and deposit income into this account.
                </span>
              </div>
            </label>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--md-on-surface)', display: 'block', marginBottom: '0.4rem' }}>
                Cross-Workspace Privacy & Detail Level
              </span>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="radio"
                    name="detailLevel"
                    value="summary"
                    checked={detailLevel === 'summary'}
                    onChange={() => setDetailLevel('summary')}
                    style={{ accentColor: 'var(--md-primary)' }}
                  />
                  <span>Summary (Recommended: masks payees/notes)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="radio"
                    name="detailLevel"
                    value="full"
                    checked={detailLevel === 'full'}
                    onChange={() => setDetailLevel('full')}
                    style={{ accentColor: 'var(--md-primary)' }}
                  />
                  <span>Full Details (shows payee names & remarks)</span>
                </label>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={countInNetWorth}
                  onChange={(e) => setCountInNetWorth(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--md-primary)' }}
                />
                <div>
                  <strong>Include in Target Net Worth</strong>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Default Off. Prevents artificial double-counting of wealth across your workspaces.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="modal-actions-bar" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn primary-glow"
              disabled={submitting || eligibleWorkspaces.length === 0}
            >
              {submitting ? 'Sharing...' : 'Confirm Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

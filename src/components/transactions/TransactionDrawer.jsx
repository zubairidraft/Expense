import { useTransactions } from '../../context/TransactionContext';
import { useAttachments } from '../../context/AttachmentContext';
import MoneyDisplay from '../ui/MoneyDisplay';

export default function TransactionDrawer({
  transaction,
  isOpen,
  onClose,
  onOpenAttachReceipt,
  onEditTransfer,
}) {
  const { deleteTransaction, updateStatus } = useTransactions();
  const { getAttachmentsForTransaction } = useAttachments();

  if (!isOpen || !transaction) return null;

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this transaction from the ledger?')) {
      deleteTransaction(transaction.id);
      onClose();
    }
  };

  const handleStatusChange = (newStatus) => {
    updateStatus(transaction.id, newStatus);
  };

  const lines = transaction.lines || [];
  const txAttachments = getAttachmentsForTransaction ? getAttachmentsForTransaction(transaction.id) : [];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer-content glass-card" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <div className="drawer-badge-row">
              <span className={`tx-type-tag ${transaction.type}`}>
                {transaction.type.toUpperCase()}
              </span>
              <span className={`tx-status-pill ${transaction.status}`}>
                {transaction.status === 'reconciled' ? '🔒 Reconciled' : transaction.status === 'cleared' ? '✓ Cleared' : '⏳ Pending'}
              </span>
            </div>
            <h2 className="drawer-title">{transaction.payee_name || 'Unlabeled Transaction'}</h2>
            <span className="drawer-date">{transaction.date}</span>
          </div>

          <button className="modal-close-btn" onClick={onClose} aria-label="Close drawer">
            ✕
          </button>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {/* Foreign Transaction Alert Banner */}
          {transaction.is_foreign && (
            <div
              className="foreign-tx-banner"
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#d97706',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                lineHeight: 1.45,
              }}
            >
              <span style={{ fontSize: '1.2rem', marginTop: '-2px' }}>🔒</span>
              <div>
                <strong style={{ display: 'block', fontSize: '0.88rem', color: '#b45309' }}>
                  Originating Workspace: {transaction.origin_workspace_name || 'Other Workspace'}
                </strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--md-on-surface-variant)' }}>
                  This transaction was posted in another workspace on this shared account. It is read-only here and can only be edited or deleted in its originating workspace.
                </span>
              </div>
            </div>
          )}

          {/* Notes Section */}
          {transaction.notes && (
            <div className="drawer-section">
              <span className="drawer-section-label">Notes & Remarks</span>
              <p className="drawer-notes-text">{transaction.notes}</p>
            </div>
          )}

          {/* Ledger Double-Entry Lines */}
          <div className="drawer-section">
            <span className="drawer-section-label">Double-Entry Ledger Lines ({lines.length})</span>
            <div className="drawer-lines-list">
              {lines.map((line, idx) => (
                <div key={line.id || idx} className="drawer-line-item">
                  <div className="line-item-header">
                    <div className="line-account-info">
                      <span className="line-acc-icon">
                        {line.account?.type === 'bank' ? '🏦' : line.account?.type === 'card' ? '💳' : '💵'}
                      </span>
                      <span className="line-acc-name">{line.account?.name || 'Financial Account'}</span>
                    </div>

                    <div className="line-amount-wrapper">
                      <span className={`line-dir-badge ${line.direction}`}>
                        {line.direction === 'in' ? '+ INFLOW' : '− OUTFLOW'}
                      </span>
                      <MoneyDisplay
                        amount={line.amount}
                        currencyCode={line.currency || 'USD'}
                        type={line.direction === 'in' ? 'income' : 'expense'}
                        showSign
                        className="line-money-display"
                      />
                    </div>
                  </div>

                  <div className="line-item-footer">
                    {line.category ? (
                      <span className="line-cat-tag">
                        <span>{line.category.icon}</span>
                        <span>{line.category.name}</span>
                      </span>
                    ) : (
                      <span className="line-cat-tag transfer">🔁 Account Transfer</span>
                    )}

                    {line.description && (
                      <span className="line-desc-text">{line.description}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          {transaction.tags && transaction.tags.length > 0 && (
            <div className="drawer-section">
              <span className="drawer-section-label">Assigned Tags</span>
              <div className="drawer-tags-row">
                {transaction.tags.map((t, idx) => (
                  <span key={idx} className="alias-chip" style={{ borderColor: t.tag?.color }}>
                    🏷️ {t.tag?.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Audit & Idempotency Metadata */}
          <div className="drawer-section metadata-section">
            <span className="drawer-section-label">Audit Metadata</span>
            <div className="drawer-meta-grid">
              <div className="meta-item">
                <span className="meta-label">Idempotency Key</span>
                <span className="meta-value code">{transaction.idempotency_key}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Ledger Version</span>
                <span className="meta-value">v{transaction.version || 1}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Origin Source</span>
                <span className="meta-value capitalize">{transaction.source || 'manual'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Booked At</span>
                <span className="meta-value">{new Date(transaction.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Attached Receipts & Invoices */}
          <div className="drawer-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="drawer-section-label">Attached Receipts ({txAttachments.length})</span>
              {onOpenAttachReceipt && (
                <button
                  type="button"
                  onClick={() => onOpenAttachReceipt(transaction.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--md-info)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  ➕ Attach Receipt
                </button>
              )}
            </div>
            {txAttachments.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, var(--md-on-surface-variant))', margin: '0.4rem 0 0' }}>
                No physical receipt or document linked yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {txAttachments.map((att) => (
                  <div
                    key={att.id}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(var(--md-on-surface-rgb), 0.03)',
                      border: '1px solid rgba(var(--md-on-surface-rgb), 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>🧾</span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--md-on-surface)' }}>
                          {att.file_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {(att.file_size / 1024).toFixed(1)} KB · OCR: {att.ocr_status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Change Selector */}
          <div className="drawer-section">
            <span className="drawer-section-label">Reconciliation Status</span>
            <div className="status-button-group">
              <button
                className={`status-btn ${transaction.status === 'pending' ? 'active' : ''}`}
                disabled={transaction.is_foreign}
                onClick={() => !transaction.is_foreign && handleStatusChange('pending')}
                style={transaction.is_foreign ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                title={transaction.is_foreign ? 'Originating workspace controls status' : undefined}
              >
                ⏳ Pending
              </button>
              <button
                className={`status-btn ${transaction.status === 'cleared' ? 'active' : ''}`}
                disabled={transaction.is_foreign}
                onClick={() => !transaction.is_foreign && handleStatusChange('cleared')}
                style={transaction.is_foreign ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                title={transaction.is_foreign ? 'Originating workspace controls status' : undefined}
              >
                ✓ Cleared
              </button>
              <button
                className={`status-btn ${transaction.status === 'reconciled' ? 'active' : ''}`}
                disabled={transaction.is_foreign}
                onClick={() => !transaction.is_foreign && handleStatusChange('reconciled')}
                style={transaction.is_foreign ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                title={transaction.is_foreign ? 'Originating workspace controls status' : undefined}
              >
                🔒 Reconciled
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="drawer-footer">
          {transaction.type === 'transfer' && !transaction.is_foreign && onEditTransfer && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                onClose();
                onEditTransfer(transaction);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>✏️</span> Edit Transfer
            </button>
          )}

          <button
            className="btn btn-danger"
            disabled={transaction.is_foreign}
            onClick={handleDelete}
            style={transaction.is_foreign ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
            title={transaction.is_foreign ? `Sirf ${transaction.origin_workspace_name || 'originating'} workspace se delete ho sakti hai` : 'Delete transaction'}
          >
            {transaction.is_foreign ? '🔒 Delete Disabled (Foreign Entry)' : '🗑️ Delete Transaction'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}

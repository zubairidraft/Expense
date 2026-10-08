import { useTransactions } from '../../context/TransactionContext';
import MoneyDisplay from '../ui/MoneyDisplay';

export default function TransactionDrawer({ transaction, isOpen, onClose }) {
  const { deleteTransaction, updateStatus } = useTransactions();

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

          {/* Status Change Selector */}
          <div className="drawer-section">
            <span className="drawer-section-label">Reconciliation Status</span>
            <div className="status-button-group">
              <button
                className={`status-btn ${transaction.status === 'pending' ? 'active' : ''}`}
                onClick={() => handleStatusChange('pending')}
              >
                ⏳ Pending
              </button>
              <button
                className={`status-btn ${transaction.status === 'cleared' ? 'active' : ''}`}
                onClick={() => handleStatusChange('cleared')}
              >
                ✓ Cleared
              </button>
              <button
                className={`status-btn ${transaction.status === 'reconciled' ? 'active' : ''}`}
                onClick={() => handleStatusChange('reconciled')}
              >
                🔒 Reconciled
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="drawer-footer">
          <button className="btn btn-danger" onClick={handleDelete}>
            🗑️ Delete Transaction
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}

import { useTransactions } from '../../context/TransactionContext';

export default function SyncStatusBadge() {
  const { isOnline, pendingOutboxCount, isSyncing, syncOutbox } = useTransactions();

  return (
    <div className="sync-status-wrapper">
      {!isOnline ? (
        <div className="sync-badge offline" title="Offline mode: writes stored locally in IndexedDB outbox">
          <span className="pulse-dot warning" />
          <span className="sync-badge-text">
            Offline · {pendingOutboxCount} {pendingOutboxCount === 1 ? 'entry' : 'entries'} queued
          </span>
        </div>
      ) : pendingOutboxCount > 0 ? (
        <button
          className="sync-badge syncing-action"
          onClick={syncOutbox}
          disabled={isSyncing}
          title="Click to push offline queued transactions to Supabase"
        >
          <span className={`sync-spin-icon ${isSyncing ? 'spinning' : ''}`}>🔄</span>
          <span className="sync-badge-text">
            {isSyncing ? 'Syncing...' : `Sync Outbox (${pendingOutboxCount})`}
          </span>
        </button>
      ) : (
        <div className="sync-badge online" title="All ledger transactions synchronized with database">
          <span className="pulse-dot active" />
          <span className="sync-badge-text">Online · Synced</span>
        </div>
      )}
    </div>
  );
}

export default function MobileNav({
  activeTab,
  onSelectTab,
  onOpenQuickAdd,
}) {
  return (
    <nav className="mobile-bottom-nav">
      <button
        className={`mobile-nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
        onClick={() => onSelectTab('overview')}
        aria-label="Dashboard"
      >
        <span className="mob-icon">📊</span>
        <span className="mob-label">Overview</span>
      </button>

      <button
        className={`mobile-nav-btn ${activeTab === 'transactions' ? 'active' : ''}`}
        onClick={() => onSelectTab('transactions')}
        aria-label="Transactions"
      >
        <span className="mob-icon">🧾</span>
        <span className="mob-label">Ledger</span>
      </button>

      {/* Floating Center Quick Add Button */}
      <button
        className="mobile-quick-add-btn"
        onClick={onOpenQuickAdd}
        title="Quick Add Transaction"
        aria-label="Quick Add Transaction"
      >
        <span className="mob-add-plus">➕</span>
      </button>

      <button
        className={`mobile-nav-btn ${activeTab === 'accounts' ? 'active' : ''}`}
        onClick={() => onSelectTab('accounts')}
        aria-label="Accounts"
      >
        <span className="mob-icon">💳</span>
        <span className="mob-label">Accounts</span>
      </button>

      <button
        className={`mobile-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => onSelectTab('settings')}
        aria-label="Settings"
      >
        <span className="mob-icon">⚙️</span>
        <span className="mob-label">Settings</span>
      </button>
    </nav>
  );
}

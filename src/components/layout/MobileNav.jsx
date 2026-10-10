import Icon from '../ui/Icon';

export default function MobileNav({
  activeTab,
  onSelectTab,
  onOpenQuickAdd,
  onOpenMore,
}) {
  const isMoreActive = !['overview', 'transactions', 'accounts'].includes(activeTab);

  return (
    <nav className="mobile-bottom-nav">
      <button
        className={`mobile-nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
        onClick={() => onSelectTab('overview')}
        aria-label="Dashboard"
      >
        <span className="mob-icon"><Icon name="dashboard" size={24} filled={activeTab === 'overview'} /></span>
        <span className="mob-label">Overview</span>
      </button>

      <button
        className={`mobile-nav-btn ${activeTab === 'transactions' ? 'active' : ''}`}
        onClick={() => onSelectTab('transactions')}
        aria-label="Transactions"
      >
        <span className="mob-icon"><Icon name="receipt_long" size={24} filled={activeTab === 'transactions'} /></span>
        <span className="mob-label">Ledger</span>
      </button>

      {/* Floating Center Quick Add Button */}
      <button
        className="mobile-quick-add-btn"
        onClick={onOpenQuickAdd}
        title="Quick Add Transaction"
        aria-label="Quick Add Transaction"
      >
        <span className="mob-add-plus"><Icon name="add" size={28} /></span>
      </button>

      <button
        className={`mobile-nav-btn ${activeTab === 'accounts' ? 'active' : ''}`}
        onClick={() => onSelectTab('accounts')}
        aria-label="Accounts"
      >
        <span className="mob-icon"><Icon name="account_balance_wallet" size={24} filled={activeTab === 'accounts'} /></span>
        <span className="mob-label">Accounts</span>
      </button>

      <button
        className={`mobile-nav-btn ${isMoreActive ? 'active' : ''}`}
        onClick={onOpenMore}
        aria-label="More modules and tools"
      >
        <span className="mob-icon"><Icon name="grid_view" size={24} filled={isMoreActive} /></span>
        <span className="mob-label">{isMoreActive ? 'Menu' : 'More'}</span>
      </button>
    </nav>
  );
}

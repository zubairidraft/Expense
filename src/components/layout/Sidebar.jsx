import { useWorkspace } from '../../context/WorkspaceContext';
import Icon from '../ui/Icon';

const NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: 'dashboard' },
  { id: 'transactions', label: 'Ledger Activity', icon: 'receipt_long' },
  { id: 'accounts', label: 'Accounts & Vaults', icon: 'account_balance_wallet' },
  { id: 'categories', label: 'Categories & Tags', icon: 'sell' },
  { id: 'recurring', label: 'Bills & Subscriptions', icon: 'event_repeat' },
  { id: 'budgets', label: 'Budgets & Goals', icon: 'savings' },
  { id: 'shared', label: 'Loans & Payables', icon: 'handshake' },
  { id: 'business', label: 'Business & Projects', icon: 'work' },
  { id: 'analytics', label: 'Visual Analytics', icon: 'insights' },
  { id: 'reports', label: 'Reports & Tax', icon: 'summarize' },
  { id: 'settings', label: 'Preferences', icon: 'settings' },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  onOpenSettings,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  onOpenCurrencyConverter,
  onOpenImportExport,
  onOpenAppearance,
}) {
  const { currentWorkspace } = useWorkspace();

  const handleSelect = (tabId) => {
    onSelectTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          aria-label="Close navigation"
        />
      )}

      <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="sidebar-logo"><Icon name="account_balance_wallet" size={22} filled /></span>
            {(!isCollapsed || isMobileOpen) && (
              <div className="sidebar-brand-text">
                <span className="sidebar-title">Next Expenses</span>
                <span className="sidebar-tag">Next Level Expense Tracking</span>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle */}
          <button
            className="sidebar-collapse-btn desktop-only"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label="Toggle sidebar"
          >
            <Icon name={isCollapsed ? 'chevron_right' : 'chevron_left'} size={22} />
          </button>

          {/* Mobile close button */}
          <button
            className="sidebar-close-btn mobile-only"
            onClick={onCloseMobile}
            title="Close navigation"
            aria-label="Close navigation"
          >
            <Icon name="close" size={22} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelect(item.id)}
                title={item.label}
              >
                <span className="nav-icon"><Icon name={item.icon} size={24} filled={isActive} /></span>
                {(!isCollapsed || isMobileOpen) && <span className="nav-label">{item.label}</span>}
                {isActive && <span className="nav-active-pip"></span>}
              </button>
            );
          })}
        </nav>

        {/* Mobile Quick Tools Strip */}
        {isMobileOpen && (
          <div className="sidebar-mobile-tools">
            <div className="sidebar-tools-label">Quick Tools</div>
            <div className="sidebar-tools-grid">
              {onOpenAppearance && (
                <button
                  type="button"
                  className="sidebar-tool-btn"
                  onClick={() => {
                    onOpenAppearance();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  title="Theme & Colors"
                >
                  <Icon name="palette" size={18} />
                  <span>Theme</span>
                </button>
              )}
              {onOpenCurrencyConverter && (
                <button
                  type="button"
                  className="sidebar-tool-btn"
                  onClick={() => {
                    onOpenCurrencyConverter();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  title="FX Rates Converter"
                >
                  <Icon name="currency_exchange" size={18} />
                  <span>FX Rates</span>
                </button>
              )}
              {onOpenImportExport && (
                <button
                  type="button"
                  className="sidebar-tool-btn"
                  onClick={() => {
                    onOpenImportExport();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  title="Import & Export Data"
                >
                  <Icon name="import_export" size={18} />
                  <span>Data/SMS</span>
                </button>
              )}
            </div>
          </div>
        )}

        {(!isCollapsed || isMobileOpen) && (
          <div className="sidebar-footer">
            <div
              className="sidebar-ws-card"
              onClick={() => {
                onOpenSettings();
                if (onCloseMobile) onCloseMobile();
              }}
              title="Click to view workspace settings"
            >
              <span className="sidebar-ws-icon">
                <Icon
                  name={
                    currentWorkspace?.type === 'business'
                      ? 'business'
                      : currentWorkspace?.type === 'household'
                      ? 'home'
                      : 'person'
                  }
                  size={22}
                />
              </span>
              <div className="sidebar-ws-meta">
                <span className="sidebar-ws-name">{currentWorkspace?.name || 'Workspace'}</span>
                <span className="sidebar-ws-role">
                  {currentWorkspace?.role?.toUpperCase() || 'OWNER'} · {currentWorkspace?.base_currency}
                </span>
              </div>
            </div>

            {/* Support: Buy Me A Coffee */}
            <a
              href="https://buymeacoffee.com/nextedgemarketing"
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-bmac-btn"
              title="Support Next Expenses on Buy Me A Coffee"
            >
              <span className="bmac-cup">☕</span>
              <span className="bmac-text">Buy Me A Coffee</span>
            </a>

            {/* Next Edge Marketing Agency Credit Banner */}
            <div className="sidebar-agency-banner">
              <span className="agency-credit-label">⚡ Built by</span>
              <span className="agency-credit-brand">Next Edge Marketing</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

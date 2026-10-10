import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher';
import SyncStatusBadge from '../ui/SyncStatusBadge';
import Icon from '../ui/Icon';

export default function Navbar({
  onOpenMobileNav,
  onOpenAuth,
  onOpenSettings,
  onOpenCreateWorkspace,
  onOpenWorkspaceMembers,
  onOpenQuickAdd,
  onOpenTransfer,
  onOpenCurrencyConverter,
  onOpenImportExport,
  onOpenNotifications,
  onOpenOnboarding,
  onOpenAppearance,
}) {
  const { user, profile, toggleTheme } = useAuth();
  const { unreadCount } = useNotifications();
  const currencyInfo = CURRENCY_REGISTRY[profile.defaultCurrency] || { symbol: profile.defaultCurrency };

  const initials = profile.fullName
    ? profile.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <header className="app-header">
      <div className="brand-section">
        {/* Mobile Hamburger Drawer Toggle */}
        <button
          type="button"
          className="mobile-nav-toggle-btn mobile-only"
          onClick={onOpenMobileNav}
          aria-label="Open Navigation Menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="brand-icon"><Icon name="account_balance_wallet" size={24} filled /></div>
        <div className="brand-text-block">
          <h1 className="app-title">Next Expenses</h1>
          <p className="app-subtitle">Next Level Expense Tracking</p>
        </div>
      </div>

      <div className="header-actions-container">
        {/* Support: Buy Me A Coffee */}
        <a
          href="https://buymeacoffee.com/nextedgemarketing"
          target="_blank"
          rel="noopener noreferrer"
          className="navbar-bmac-btn desktop-only"
          title="Support Next Expenses on Buy Me A Coffee"
        >
          <span className="bmac-cup">☕</span>
          <span className="bmac-label">Buy Coffee</span>
        </a>

        {/* Primary Action: Quick Add (Desktop only; mobile uses prominent bottom FAB) */}
        <button
          className="navbar-quick-add-btn desktop-only"
          onClick={onOpenQuickAdd}
          title="Speed entry: Quick log transaction (Ctrl+K)"
        >
          <Icon name="add" size={20} />
          <span className="quick-btn-text">Quick Add</span>
          <kbd className="quick-kbd">Ctrl+K</kbd>
        </button>

        {onOpenTransfer && (
          <button
            className="btn-secondary desktop-only"
            onClick={() => onOpenTransfer()}
            title="Transfer money between accounts"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              height: '40px',
              padding: '0 0.85rem',
              borderRadius: '8px',
              fontWeight: 500,
            }}
          >
            <Icon name="swap_horiz" size={20} />
            <span className="nav-btn-text">Transfer</span>
          </button>
        )}

        {/* Utility Actions Bar */}
        <div className="header-utilities-bar">
          {/* Quick Theme Toggle */}
          <button
            className="btn-secondary theme-toggle-btn"
            data-testid="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Theme: ${profile.theme || 'dark'}. Click to toggle.`}
          >
            <Icon name={profile.theme === 'light' ? 'light_mode' : 'dark_mode'} size={20} />
            <span className="nav-btn-text">{profile.theme === 'light' ? 'Light' : 'Dark'}</span>
          </button>

          {/* Appearance / colours */}
          {onOpenAppearance && (
            <button
              className="btn-secondary nav-util-desktop"
              onClick={onOpenAppearance}
              title="Customize colours, shape & font"
              aria-label="Appearance"
            >
              <Icon name="palette" size={20} />
              <span className="nav-btn-text">Theme</span>
            </button>
          )}

          {/* FX Rates */}
          <button
            className="btn-secondary nav-util-desktop"
            onClick={onOpenCurrencyConverter}
            title="Live Multi-Currency FX Rates & Converter"
          >
            <Icon name="currency_exchange" size={20} />
            <span className="nav-btn-text">FX Rates</span>
          </button>

          {/* Import / Export */}
          <button
            className="btn-secondary nav-util-desktop"
            onClick={onOpenImportExport}
            title="Bank SMS Parser, CSV Import & Export Backup"
          >
            <Icon name="import_export" size={20} />
            <span className="nav-btn-text">Data</span>
          </button>

          {/* Notifications */}
          <button
            className="btn-secondary"
            onClick={onOpenNotifications}
            title="In-App Notifications & Alerts"
            style={{ position: 'relative' }}
          >
            <Icon name="notifications" size={20} />
            {unreadCount > 0 && (
              <span className="nav-badge-count">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Sync Status Badge */}
          <span className="nav-util-desktop">
            <SyncStatusBadge />
          </span>
        </div>

        {/* Account & Workspace Cluster */}
        <div className="header-account-cluster">
          <WorkspaceSwitcher
            onOpenCreate={onOpenCreateWorkspace}
            onOpenMembers={onOpenWorkspaceMembers}
          />

          {user ? (
            <div className="user-profile-menu">
              <button
                className="user-profile-btn"
                onClick={() => onOpenSettings()}
                title="Click to open preferences"
              >
                <div className="user-avatar-tag">{initials}</div>
                <div className="user-info-text">
                  <span className="user-display-name">{profile.fullName || user.email?.split('@')[0]}</span>
                  <span className="user-currency-badge">
                    {profile.defaultCurrency} ({currencyInfo.symbol})
                  </span>
                </div>
                <span className="dropdown-arrow"><Icon name="settings" size={18} /></span>
              </button>
            </div>
          ) : (
            <div className="guest-auth-actions">
              <button
                onClick={() => onOpenSettings()}
                className="guest-currency-btn"
                title="Change preferences & currency settings"
              >
                <Icon name="language" size={18} /> {profile.defaultCurrency} ({currencyInfo.symbol})
              </button>
              <button
                onClick={() => onOpenAuth()}
                className="auth-cta-btn primary-glow"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

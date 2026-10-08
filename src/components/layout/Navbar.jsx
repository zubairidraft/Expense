import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher';
import SyncStatusBadge from '../ui/SyncStatusBadge';

export default function Navbar({
  onOpenAuth,
  onOpenSettings,
  onOpenCreateWorkspace,
  onOpenWorkspaceMembers,
  onOpenQuickAdd,
  onOpenCurrencyConverter,
  onOpenImportExport,
  onOpenNotifications,
}) {
  const { user, profile } = useAuth();
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
        <div className="brand-icon">💎</div>
        <div>
          <h1 className="app-title">Expense Tracker Pro</h1>
          <p className="app-subtitle">Multi-Currency Financial Ledger v2.0</p>
        </div>
      </div>

      <div className="header-badges">
        {/* Offline & Sync Status Pill */}
        <SyncStatusBadge />

        {/* Currency Rates Modal Action */}
        <button
          className="btn-secondary"
          style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          onClick={onOpenCurrencyConverter}
          title="Live Multi-Currency FX Rates & Converter"
        >
          <span>💱</span>
          <span>FX Rates</span>
        </button>

        {/* Data In & Out Modal Action */}
        <button
          className="btn-secondary"
          style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          onClick={onOpenImportExport}
          title="Bank SMS Parser, CSV Import & Export Backup"
        >
          <span>📲</span>
          <span>Import / Export</span>
        </button>

        {/* Notifications & Alerts Bell */}
        <button
          className="btn-secondary"
          style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem', position: 'relative' }}
          onClick={onOpenNotifications}
          title="In-App Notification Center & Alerts"
        >
          <span>🔔</span>
          <span>Alerts</span>
          {unreadCount > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '8px',
                padding: '0.1rem 0.35rem',
                fontSize: '0.7rem',
                fontWeight: '700',
                marginLeft: '0.2rem',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* Global Quick Add Button */}
        <button
          className="navbar-quick-add-btn"
          onClick={onOpenQuickAdd}
          title="Speed entry: Quick log transaction (Ctrl+K or /)"
        >
          <span>⚡</span>
          <span className="quick-btn-text">Quick Add</span>
          <kbd className="quick-kbd">Ctrl+K</kbd>
        </button>

        {/* Workspace Switcher */}
        <WorkspaceSwitcher
          onOpenCreate={onOpenCreateWorkspace}
          onOpenMembers={onOpenWorkspaceMembers}
        />


        <div className="agent-badge" title="Agentation real-time UI inspection server active">
          <span className="pulse-dot"></span>
          Agentation Live
        </div>

        {user ? (
          <div className="user-profile-menu">
            <button
              className="user-profile-btn"
              onClick={() => onOpenSettings()}
              title="Click to edit profile & currency preferences"
            >
              <div className="user-avatar-tag">{initials}</div>
              <div className="user-info-text">
                <span className="user-display-name">{profile.fullName || user.email?.split('@')[0]}</span>
                <span className="user-currency-badge">
                  {profile.defaultCurrency} ({currencyInfo.symbol}) · {profile.numberFormat === 'lakh' ? 'Lakh' : 'Intl'}
                </span>
              </div>
              <span className="dropdown-arrow">⚙️</span>
            </button>
          </div>
        ) : (
          <div className="guest-auth-actions">
            <button
              onClick={() => onOpenSettings()}
              className="guest-currency-btn"
              title="Change guest currency and format settings"
            >
              🌐 {profile.defaultCurrency} ({currencyInfo.symbol})
            </button>
            <button
              onClick={() => onOpenAuth()}
              className="auth-cta-btn primary-glow"
            >
              Sign In / Register
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

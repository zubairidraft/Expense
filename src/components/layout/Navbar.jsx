import { useAuth } from '../../context/AuthContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher';

export default function Navbar({
  onOpenAuth,
  onOpenSettings,
  onOpenCreateWorkspace,
  onOpenWorkspaceMembers,
}) {
  const { user, profile } = useAuth();
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

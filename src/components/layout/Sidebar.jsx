import { useWorkspace } from '../../context/WorkspaceContext';

const NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: '📊' },
  { id: 'transactions', label: 'Ledger Activity', icon: '🧾' },
  { id: 'accounts', label: 'Accounts & Vaults', icon: '💳' },
  { id: 'categories', label: 'Categories & Tags', icon: '🏷️' },
  { id: 'budgets', label: 'Budgets & Goals', icon: '🎯' },
  { id: 'analytics', label: 'Visual Analytics', icon: '📈' },
  { id: 'settings', label: 'Preferences', icon: '⚙️' },
];


export default function Sidebar({
  activeTab,
  onSelectTab,
  onOpenSettings,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const { currentWorkspace } = useWorkspace();

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-logo">💎</span>
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-title">Expense Pro</span>
              <span className="sidebar-tag">v2.0 Foundation</span>
            </div>
          )}
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label="Toggle sidebar"
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {!isCollapsed && <span className="nav-label">{item.label}</span>}
              {isActive && <span className="nav-active-pip"></span>}
            </button>
          );
        })}
      </nav>

      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="sidebar-ws-card" onClick={onOpenSettings} title="Click to view workspace settings">
            <span className="sidebar-ws-icon">
              {currentWorkspace?.type === 'business'
                ? '🏢'
                : currentWorkspace?.type === 'household'
                ? '🏠'
                : '👤'}
            </span>
            <div className="sidebar-ws-meta">
              <span className="sidebar-ws-name">{currentWorkspace?.name || 'Workspace'}</span>
              <span className="sidebar-ws-role">
                {currentWorkspace?.role?.toUpperCase() || 'OWNER'} · {currentWorkspace?.base_currency}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

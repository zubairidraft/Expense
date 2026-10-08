import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

const WORKSPACE_ICONS = {
  personal: '👤',
  household: '🏠',
  business: '🏢',
  custom: '📁',
};

export default function WorkspaceSwitcher({ onOpenCreate, onOpenMembers }) {
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const typeIcon = WORKSPACE_ICONS[currentWorkspace?.type] || '📁';

  return (
    <div className="workspace-switcher-container" ref={dropdownRef}>
      <button
        className="workspace-current-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Switch Workspace"
      >
        <span className="ws-type-icon">{typeIcon}</span>
        <div className="ws-text-group">
          <span className="ws-name">{currentWorkspace?.name || 'Workspace'}</span>
          <span className="ws-role-tag">
            {currentWorkspace?.role ? currentWorkspace.role.toUpperCase() : 'OWNER'} · {currentWorkspace?.base_currency || 'USD'}
          </span>
        </div>
        <span className="ws-caret">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="workspace-dropdown glass-card">
          <div className="ws-dropdown-header">
            <span>Workspaces</span>
            <span className="ws-count">{workspaces.length}</span>
          </div>

          <div className="ws-list">
            {workspaces.map((ws) => {
              const isSelected = ws.id === currentWorkspace?.id;
              const icon = WORKSPACE_ICONS[ws.type] || '📁';
              return (
                <button
                  key={ws.id}
                  className={`ws-item ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    switchWorkspace(ws.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="ws-item-icon">{icon}</span>
                  <div className="ws-item-info">
                    <span className="ws-item-title">{ws.name}</span>
                    <span className="ws-item-meta">
                      {ws.type} · {ws.base_currency} · {ws.role || 'member'}
                    </span>
                  </div>
                  {isSelected && <span className="ws-item-check">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="ws-dropdown-footer">
            <button
              className="ws-action-btn"
              onClick={() => {
                setIsOpen(false);
                onOpenCreate();
              }}
            >
              <span>➕</span> Create Workspace
            </button>
            <button
              className="ws-action-btn"
              onClick={() => {
                setIsOpen(false);
                onOpenMembers();
              }}
            >
              <span>⚙️</span> Workspace Members & Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

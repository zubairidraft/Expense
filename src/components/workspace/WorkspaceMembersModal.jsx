import { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';

export default function WorkspaceMembersModal({ isOpen, onClose }) {
  const { currentWorkspace, members, fetchMembers, archiveWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteStatus, setInviteStatus] = useState('');
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (isOpen && currentWorkspace?.id) {
      fetchMembers(currentWorkspace.id);
    }
  }, [isOpen, currentWorkspace?.id, fetchMembers]);

  if (!isOpen || !currentWorkspace) return null;

  const isOwnerOrAdmin = currentWorkspace.role === 'owner' || currentWorkspace.role === 'admin';

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteStatus(`Invitation sent to ${inviteEmail} as ${inviteRole}!`);
    setInviteEmail('');
    setTimeout(() => setInviteStatus(''), 2500);
  };

  const handleArchive = async () => {
    if (!window.confirm(`Are you sure you want to archive "${currentWorkspace.name}"?`)) return;
    setArchiving(true);
    await archiveWorkspace(currentWorkspace.id);
    setArchiving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">{currentWorkspace.name} Settings</h2>
            <p className="modal-subtitle">
              Manage workspace collaborators, access permissions, and lifecycle
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="ws-meta-badge-row">
          <span className="ws-badge">Type: {currentWorkspace.type}</span>
          <span className="ws-badge">Currency: {currentWorkspace.base_currency}</span>
          <span className="ws-badge">Your Role: {currentWorkspace.role || 'Member'}</span>
        </div>

        {/* Members List Section */}
        <div className="ws-members-section">
          <h3 className="section-subheading">Workspace Members ({members.length})</h3>
          <div className="ws-member-cards">
            {members.length === 0 ? (
              <div className="empty-state">
                <span>👤</span> Only you have access to this workspace.
              </div>
            ) : (
              members.map((m) => (
                <div key={m.id} className="ws-member-row">
                  <div className="member-avatar">
                    {m.profiles?.full_name ? m.profiles.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="member-info">
                    <span className="member-name">
                      {m.profiles?.full_name || (m.user_id === user?.id ? 'You' : 'Member')}
                    </span>
                    <span className="member-role-tag">{m.role.toUpperCase()}</span>
                  </div>
                  <span className={`status-pill ${m.status}`}>{m.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Invite Member Section */}
        {isOwnerOrAdmin && (
          <form onSubmit={handleInvite} className="ws-invite-form">
            <h3 className="section-subheading">Invite Collaborator</h3>
            {inviteStatus && (
              <div className="auth-alert success">
                <span>✓</span> {inviteStatus}
              </div>
            )}
            <div className="form-row-2">
              <input
                type="email"
                required
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="input-field"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="input-field"
              >
                <option value="viewer">Viewer (Read-only)</option>
                <option value="member">Member (Add transactions)</option>
                <option value="manager">Manager (Manage accounts)</option>
                <option value="admin">Admin (Manage members)</option>
              </select>
            </div>
            <button type="submit" className="submit-btn primary-glow">
              Send Invite
            </button>
          </form>
        )}

        {/* Workspace Archival (Owner only) */}
        {currentWorkspace.role === 'owner' && (
          <div className="ws-danger-zone">
            <button
              type="button"
              disabled={archiving}
              onClick={handleArchive}
              className="btn-danger-outline"
            >
              {archiving ? 'Archiving...' : 'Archive This Workspace'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

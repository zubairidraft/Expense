import { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

// Shown to a signed-in user who has been invited (by email) to other workspaces.
export default function PendingInvitations() {
  const { myInvitations, acceptInvitation, declineInvitation } = useWorkspace();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  if (!myInvitations || myInvitations.length === 0) return null;

  const onAccept = async (inv) => {
    setBusyId(inv.id);
    setError('');
    const res = await acceptInvitation(inv.token);
    setBusyId(null);
    if (res?.error) setError(res.error.message);
  };

  const onDecline = async (inv) => {
    setBusyId(inv.id);
    setError('');
    const res = await declineInvitation(inv.id);
    setBusyId(null);
    if (res?.error) setError(res.error.message);
  };

  return (
    <div
      role="region"
      aria-label="Workspace invitations"
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: 1200,
        width: 'min(380px, calc(100vw - 32px))',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {myInvitations.map((inv) => (
        <div
          key={inv.id}
          className="card glass-card"
          style={{ padding: '1rem 1.1rem', boxShadow: 'var(--md-elev-3, 0 8px 24px rgba(0,0,0,0.35))' }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Join “{inv.workspace_name}”?
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            {inv.invited_by_name} invited you as <strong>{String(inv.role).toUpperCase()}</strong>.
          </div>
          {error && (
            <div className="auth-alert error" style={{ marginBottom: '0.5rem' }}>
              <span>!</span> {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-pill" disabled={busyId === inv.id} onClick={() => onDecline(inv)}>
              Decline
            </button>
            <button type="button" className="btn-primary" disabled={busyId === inv.id} onClick={() => onAccept(inv)}>
              {busyId === inv.id ? 'Please wait…' : 'Accept'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

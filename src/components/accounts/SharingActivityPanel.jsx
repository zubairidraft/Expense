import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAccounts } from '../../context/AccountContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

const money = (n, cur) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur || ''}`.trim();

function describe(ev) {
  const d = ev.detail || {};
  const who = ev.actor_name || 'Someone';
  if (ev.kind === 'share_created') {
    const perms = `${d.can_post ? 'posting allowed' : 'view only'}, ${d.detail_level === 'full' ? 'full details' : 'summary'}`;
    return d.direction === 'out'
      ? `${who} shared "${ev.account_name}" with workspace "${ev.workspace_name}" (${perms})`
      : `${who} shared "${ev.account_name}" with your workspace (${perms})`;
  }
  if (ev.kind === 'share_revoked') {
    return d.direction === 'out'
      ? `Sharing of "${ev.account_name}" with "${ev.workspace_name}" was revoked`
      : `Sharing of "${ev.account_name}" with your workspace was revoked`;
  }
  if (ev.kind === 'tx_posted') {
    const where = d.from_other_workspace ? `from "${ev.workspace_name}"` : 'from this workspace';
    const label = d.type === 'transfer' ? 'transfer' : d.type === 'income' ? 'income' : 'expense';
    return `${who} recorded an ${label} on "${ev.account_name}" ${where}: ${d.payee || 'Unlabeled'} — ${money(d.amount, d.currency)}${d.deleted ? ' (subsequently deleted)' : ''}`;
  }
  return who;
}

const ICON = { share_created: '🔗', share_revoked: '⛔', tx_posted: '🧾' };

export default function SharingActivityPanel() {
  const { accountShares = [], revokeAccountShare } = useAccounts();
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const wsId = currentWorkspace?.id;
  const isReal = Boolean(wsId && wsId !== 'guest-space');

  const active = useMemo(
    () => accountShares.filter((s) => (s.status || 'active') === 'active' && !s.revoked_at),
    [accountShares]
  );
  const outgoing = active.filter((s) => (s.home_workspace_id || null) === wsId);
  const incoming = active.filter((s) => (s.target_workspace_id || s.workspace_id) === wsId && (s.home_workspace_id || null) !== wsId);

  const load = useCallback(async () => {
    if (!isReal) return;
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.rpc('shared_account_activity', { p_workspace_id: wsId, p_limit: 60 });
    if (err) setError(err.message);
    else setEvents(data || []);
    setLoading(false);
  }, [isReal, wsId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleRevoke = async (s) => {
    const target = s.target_workspace_id || s.workspace_id;
    const res = await revokeAccountShare(s.account_id, target);
    if (res?.error) showToast({ message: res.error.message || 'Failed to revoke share', tone: 'error', duration: 4000 });
    else {
      showToast({ message: `Share for "${s.account_name}" revoked`, duration: 4000 });
      load();
    }
  };

  const box = { padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.25)', marginBottom: '0.5rem' };

  return (
    <section className="panel" aria-label="Sharing rules and activity" style={{ marginTop: '1.5rem' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.25rem 0', font: 'inherit' }}
      >
        <span style={{ fontWeight: 700 }}>🔗 Sharing Rules & Activity {active.length > 0 && `(${active.length} active)`}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: '0.9rem' }}>
          <h4 style={{ margin: '0 0 0.4rem' }}>Rules</h4>
          <ul style={{ margin: '0 0 1rem 1.1rem', padding: 0, fontSize: '0.86rem', lineHeight: 1.6, opacity: 0.9 }}>
            <li>Accounts always remain owned by their <b>home workspace</b>; sharing grants access to other workspaces.</li>
            <li>When <b>posting is allowed</b>, the target workspace can book transactions against this account; otherwise it is view-only.</li>
            <li><b>Detail Level:</b> "Summary" conceals payee and transaction notes, while "Full" displays complete details.</li>
            <li><b>Net Worth:</b> Each share independently controls whether account balances are included in the target's net worth calculation.</li>
            <li>Transactions from other workspaces are <b>read-only</b> here; modifications and deletions must occur in their originating workspace.</li>
            <li>Revoking access does not delete past transactions; it only disables further access.</li>
            <li>Note: Only <b>explicit actions</b> are recorded (shares, revocations, transactions). Passive viewing is not logged.</li>
          </ul>

          <h4 style={{ margin: '0 0 0.4rem' }}>Shared by this Workspace ({outgoing.length})</h4>
          {outgoing.length === 0 && <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 0 }}>No accounts currently shared.</p>}
          {outgoing.map((s) => (
            <div key={s.share_id || s.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ fontSize: '0.88rem' }}>
                <b>{s.account_name}</b> → {s.target_workspace_name || 'Workspace'}
                <div style={{ fontSize: '0.76rem', opacity: 0.75 }}>
                  {s.can_post ? '✓ posting allowed' : '🔒 view only'} · {s.detail_level === 'full' ? 'full detail' : 'summary'} · {s.count_in_net_worth ? 'included in net worth' : 'excluded from net worth'}
                </div>
              </div>
              <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', color: 'var(--md-error)' }} onClick={() => handleRevoke(s)}>
                Revoke
              </button>
            </div>
          ))}

          <h4 style={{ margin: '0.8rem 0 0.4rem' }}>Shared with this Workspace ({incoming.length})</h4>
          {incoming.length === 0 && <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 0 }}>No accounts have been shared with this workspace.</p>}
          {incoming.map((s) => (
            <div key={s.share_id || s.id} style={box}>
              <div style={{ fontSize: '0.88rem' }}>
                <b>{s.account_name}</b> ← {s.home_workspace_name || 'Workspace'}
                <div style={{ fontSize: '0.76rem', opacity: 0.75 }}>
                  {s.can_post ? '✓ posting allowed' : '🔒 view only'} · {s.detail_level === 'full' ? 'full detail' : 'summary'}
                </div>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0 0.4rem' }}>
            <h4 style={{ margin: 0 }}>Activity log</h4>
            {isReal && (
              <button type="button" className="secondary-btn" onClick={load} disabled={loading} style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}>
                {loading ? '…' : '↻ Refresh'}
              </button>
            )}
          </div>
          {!isReal && <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Activity log will appear once signed in.</p>}
          {error && <p role="alert" style={{ color: '#d97706', fontSize: '0.85rem' }}>{error}</p>}
          {isReal && !loading && !error && events.length === 0 && <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>No shared activity recorded yet.</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {events.map((ev, i) => (
              <li key={`${ev.event_at}-${i}`} style={{ display: 'flex', gap: '0.6rem', padding: '0.5rem 0', borderTop: '1px solid rgba(148,163,184,0.18)', fontSize: '0.85rem' }}>
                <span>{ICON[ev.kind] || '•'}</span>
                <span style={{ flex: 1 }}>{describe(ev)}</span>
                <span style={{ opacity: 0.6, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{fmtDate(ev.event_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

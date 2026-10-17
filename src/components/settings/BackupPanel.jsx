import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { buildBackup, downloadBackupJson, downloadBackupXlsx, restoreBackup } from '../../lib/backup';

export default function BackupPanel() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const run = async (label, fn) => {
    setBusy(label);
    setMsg(null);
    try { await fn(); } catch (e) { setMsg({ error: true, text: e.message || String(e) }); }
    setBusy('');
  };

  const exportAs = (kind) => run(kind, async () => {
    const b = await buildBackup(currentWorkspace);
    if (kind === 'json') downloadBackupJson(b); else await downloadBackupXlsx(b);
    setMsg({ text: `Backup created: ${b.transactions.length} transactions, ${b.accounts.length} accounts.` });
  });

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run('restore', async () => {
      const backup = JSON.parse(await file.text());
      const n = backup?.transactions?.length ?? 0;
      if (!window.confirm(`Restore ${n} transactions into "${currentWorkspace?.name}"? Existing accounts and categories will not be duplicated.`)) return;
      const r = await restoreBackup(backup, currentWorkspace.id, user.id, (t) => setBusy(t));
      setMsg({ text: `Restore complete: ${r.transactions} transactions, ${r.accounts} new accounts, ${r.categories} categories. ${r.skipped ? `${r.skipped} skipped (already exists or missing account).` : ''} Please refresh the app.` });
    });
  };

  const box = { padding: '1.5rem', borderRadius: 12, background: 'var(--bg-main, rgba(0,0,0,0.15))', border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
      <div style={box}>
        <h4 style={{ margin: '0 0 .5rem' }}>📥 Full Backup (This Workspace)</h4>
        <p style={{ margin: '0 0 1rem', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          Accounts, categories, merchants, tags, budgets, and all ledger transactions. JSON backups can be restored; Excel is formatted for viewing and sharing.
        </p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" disabled={!!busy} onClick={() => exportAs('json')}>{busy === 'json' ? 'Generating…' : 'JSON Backup'}</button>
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => exportAs('xlsx')}>{busy === 'xlsx' ? 'Generating…' : 'Excel Backup'}</button>
        </div>
      </div>
      <div style={box}>
        <h4 style={{ margin: '0 0 .5rem' }}>📤 Restore from Backup</h4>
        <p style={{ margin: '0 0 1rem', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          Select a JSON backup file. No duplicates will be created: accounts and categories with matching names are reused, and transactions are deduplicated.
        </p>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
        <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          {busy && busy !== 'json' && busy !== 'xlsx' ? busy : 'Select JSON File'}
        </button>
      </div>
      {msg && (
        <div style={{ gridColumn: '1 / -1', padding: '.6rem .9rem', borderRadius: 8, fontSize: '.85rem', background: msg.error ? 'rgba(220,50,50,.12)' : 'rgba(40,160,90,.12)', color: msg.error ? '#d33' : 'var(--md-success, #2a8)' }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

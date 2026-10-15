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
    setMsg({ text: `Backup ban gaya: ${b.transactions.length} transactions, ${b.accounts.length} accounts.` });
  });

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run('restore', async () => {
      const backup = JSON.parse(await file.text());
      const n = backup?.transactions?.length ?? 0;
      if (!window.confirm(`"${currentWorkspace?.name}" mein ${n} transactions wapas laye jayen? Jo accounts/categories pehle se hain woh dobara nahi banenge.`)) return;
      const r = await restoreBackup(backup, currentWorkspace.id, user.id, (t) => setBusy(t));
      setMsg({ text: `Restore ho gaya: ${r.transactions} transactions, ${r.accounts} naye accounts, ${r.categories} categories. ${r.skipped ? `${r.skipped} skip (pehle se maujood ya account missing).` : ''} App refresh karo.` });
    });
  };

  const box = { padding: '1.5rem', borderRadius: 12, background: 'var(--bg-main, rgba(0,0,0,0.15))', border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
      <div style={box}>
        <h4 style={{ margin: '0 0 .5rem' }}>📥 Poora backup (is workspace ka)</h4>
        <p style={{ margin: '0 0 1rem', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          Accounts, categories, merchants, tags, budgets aur saari transactions. JSON se wapas restore ho sakta hai; Excel dekhne/share ke liye hai.
        </p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" disabled={!!busy} onClick={() => exportAs('json')}>{busy === 'json' ? 'Ban raha hai…' : 'JSON backup'}</button>
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => exportAs('xlsx')}>{busy === 'xlsx' ? 'Ban raha hai…' : 'Excel backup'}</button>
        </div>
      </div>
      <div style={box}>
        <h4 style={{ margin: '0 0 .5rem' }}>📤 Backup se restore</h4>
        <p style={{ margin: '0 0 1rem', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          JSON backup file chunein. Duplicate nahi bante: same naam ke accounts/categories reuse hote hain, aur dobara restore karne par transactions double nahi hoti.
        </p>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
        <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          {busy && busy !== 'json' && busy !== 'xlsx' ? busy : 'JSON file chunein'}
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

// Full workspace backup / restore (JSON + Excel export, JSON restore).
import { supabase } from './supabase';
import { triggerBlobDownload } from './export/download';

const PAGE = 1000;
export const BACKUP_VERSION = 1;

async function fetchAll(table, build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(supabase.from(table).select('*')).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function buildBackup(workspace) {
  const ws = workspace.id;
  const byWs = (q) => q.eq('workspace_id', ws);
  const [accounts, categories, merchants, tags, budgets, transactions] = await Promise.all([
    fetchAll('accounts', byWs),
    fetchAll('categories', byWs),
    fetchAll('merchants', byWs),
    fetchAll('tags', byWs),
    fetchAll('budgets', byWs),
    fetchAll('transactions', (q) => byWs(q).is('deleted_at', null)),
  ]);

  const txIds = transactions.map((t) => t.id);
  const lines = [];
  const txTags = [];
  for (let i = 0; i < txIds.length; i += 200) {
    const chunk = txIds.slice(i, i + 200);
    const [l, tt] = await Promise.all([
      fetchAll('transaction_lines', (q) => q.in('transaction_id', chunk)),
      fetchAll('transaction_tags', (q) => q.in('transaction_id', chunk)),
    ]);
    lines.push(...l);
    txTags.push(...tt);
  }

  return {
    app: 'next-expenses',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: { id: ws, name: workspace.name, base_currency: workspace.base_currency || workspace.baseCurrency },
    accounts, categories, merchants, tags, budgets,
    transactions, transaction_lines: lines, transaction_tags: txTags,
  };
}

const stamp = () => new Date().toISOString().slice(0, 10);
const safe = (s) => String(s || 'workspace').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 30);

export function downloadBackupJson(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  triggerBlobDownload(blob, `NextExpenses_Backup_${safe(backup.workspace?.name)}_${stamp()}.json`);
}

export async function downloadBackupXlsx(backup) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const add = (name, rows) => {
    const sheet = wb.addWorksheet(name);
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    sheet.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(32, Math.max(10, c.length + 2)) }));
    rows.forEach((r) => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
  };
  const acc = Object.fromEntries(backup.accounts.map((a) => [a.id, a.name]));
  const cat = Object.fromEntries(backup.categories.map((c) => [c.id, c.name]));
  const tx = Object.fromEntries(backup.transactions.map((t) => [t.id, t]));
  add('Accounts', backup.accounts.map(({ id, name, type, currency, opening_balance, archived_at }) => ({ id, name, type, currency, opening_balance, archived_at })));
  add('Categories', backup.categories.map(({ id, name, kind, parent_id }) => ({ id, name, kind, parent: cat[parent_id] || '' })));
  add('Transactions', backup.transaction_lines.map((l) => {
    const t = tx[l.transaction_id] || {};
    return {
      date: t.date, type: t.type, status: t.status, payee: t.payee_name, notes: t.notes,
      account: acc[l.account_id] || '', category: cat[l.category_id] || '', direction: l.direction,
      amount: Number(l.amount), currency: l.currency, base_amount: Number(l.base_amount), description: l.description,
      transaction_id: l.transaction_id,
    };
  }).sort((a, b) => String(b.date).localeCompare(String(a.date))));
  add('Budgets', backup.budgets.map((b) => ({ category: cat[b.category_id] || '', period: b.period, amount: Number(b.amount), currency: b.currency, start_date: b.start_date, end_date: b.end_date })));
  const buf = await wb.xlsx.writeBuffer();
  triggerBlobDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `NextExpenses_Backup_${safe(backup.workspace?.name)}_${stamp()}.xlsx`
  );
}

async function insertRows(table, rows, select = 'id') {
  const out = [];
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await supabase.from(table).insert(rows.slice(i, i + 200)).select(select);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
  }
  return out;
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

/**
 * Restore a JSON backup INTO the given workspace. Existing accounts / categories /
 * merchants / tags with the same name are reused (no duplicates). Transactions are
 * tagged with idempotency_key "restore:<old id>" so running a restore twice is safe.
 */
export async function restoreBackup(backup, workspaceId, userId, onProgress = () => {}) {
  if (!backup || backup.app !== 'next-expenses' || !Array.isArray(backup.transactions)) {
    throw new Error('Invalid backup file. This file does not appear to be a Next Expenses backup.');
  }
  const ws = workspaceId;
  const report = { accounts: 0, categories: 0, merchants: 0, tags: 0, transactions: 0, skipped: 0 };
  const key = (s) => String(s || '').trim().toLowerCase();

  // Accounts
  onProgress('Accounts…');
  const exAcc = await fetchAll('accounts', (q) => q.eq('workspace_id', ws));
  const accMap = {};
  const newAcc = [];
  for (const a of backup.accounts || []) {
    const hit = exAcc.find((x) => key(x.name) === key(a.name) && x.currency === a.currency);
    if (hit) accMap[a.id] = hit.id; else newAcc.push(a);
  }
  const createdAcc = await insertRows('accounts', newAcc.map((a) => ({
    ...pick(a, ['name', 'type', 'nature', 'currency', 'opening_balance', 'opening_date', 'credit_limit', 'visibility', 'icon', 'color', 'archived_at']),
    workspace_id: ws,
  })), 'id,name,currency');
  newAcc.forEach((a, i) => { accMap[a.id] = createdAcc[i].id; });
  report.accounts = newAcc.length;

  // Categories (parents first)
  onProgress('Categories…');
  const exCat = await fetchAll('categories', (q) => q.eq('workspace_id', ws));
  const catMap = {};
  const cats = backup.categories || [];
  for (const pass of [0, 1]) {
    const todo = [];
    for (const c of cats.filter((c) => (pass === 0 ? !c.parent_id : !!c.parent_id))) {
      const hit = exCat.find((x) => key(x.name) === key(c.name) && x.kind === c.kind && (x.parent_id || null) === (c.parent_id ? catMap[c.parent_id] || null : null));
      if (hit) catMap[c.id] = hit.id; else todo.push(c);
    }
    const created = await insertRows('categories', todo.map((c) => ({
      ...pick(c, ['name', 'kind', 'is_essential', 'icon', 'color', 'system_key', 'archived_at']),
      workspace_id: ws,
      parent_id: c.parent_id ? catMap[c.parent_id] || null : null,
    })), 'id');
    todo.forEach((c, i) => { catMap[c.id] = created[i].id; });
    report.categories += todo.length;
  }

  // Merchants
  onProgress('Merchants & tags…');
  const exMer = await fetchAll('merchants', (q) => q.eq('workspace_id', ws));
  const merMap = {};
  const newMer = [];
  for (const m of backup.merchants || []) {
    const hit = exMer.find((x) => key(x.name) === key(m.name));
    if (hit) merMap[m.id] = hit.id; else newMer.push(m);
  }
  const createdMer = await insertRows('merchants', newMer.map((m) => ({
    ...pick(m, ['name', 'aliases', 'logo_url']), workspace_id: ws,
    default_category_id: m.default_category_id ? catMap[m.default_category_id] || null : null,
  })));
  newMer.forEach((m, i) => { merMap[m.id] = createdMer[i].id; });
  report.merchants = newMer.length;

  // Tags
  const exTag = await fetchAll('tags', (q) => q.eq('workspace_id', ws));
  const tagMap = {};
  const newTags = [];
  for (const t of backup.tags || []) {
    const hit = exTag.find((x) => key(x.name) === key(t.name));
    if (hit) tagMap[t.id] = hit.id; else newTags.push(t);
  }
  const createdTags = await insertRows('tags', newTags.map((t) => ({ ...pick(t, ['name', 'color']), workspace_id: ws })));
  newTags.forEach((t, i) => { tagMap[t.id] = createdTags[i].id; });
  report.tags = newTags.length;

  // Transactions (skip those already restored)
  onProgress('Transactions…');
  const existingKeys = new Set(
    (await fetchAll('transactions', (q) => q.eq('workspace_id', ws).like('idempotency_key', 'restore:%'))).map((t) => t.idempotency_key)
  );
  const linesByTx = {};
  for (const l of backup.transaction_lines || []) (linesByTx[l.transaction_id] ||= []).push(l);
  const tagsByTx = {};
  for (const tt of backup.transaction_tags || []) (tagsByTx[tt.transaction_id] ||= []).push(tt.tag_id);

  const todoTx = [];
  for (const t of backup.transactions) {
    const k = `restore:${t.id}`;
    const ls = linesByTx[t.id] || [];
    if (existingKeys.has(k) || !ls.length || ls.some((l) => !accMap[l.account_id])) { report.skipped++; continue; }
    todoTx.push(t);
  }
  for (let i = 0; i < todoTx.length; i += 100) {
    const chunk = todoTx.slice(i, i + 100);
    const created = await insertRows('transactions', chunk.map((t) => ({
      ...pick(t, ['type', 'date', 'status', 'payee_name', 'notes', 'source']),
      workspace_id: ws, created_by: userId,
      merchant_id: t.merchant_id ? merMap[t.merchant_id] || null : null,
      idempotency_key: `restore:${t.id}`,
    })));
    const lineRows = [];
    const tagRows = [];
    chunk.forEach((t, j) => {
      const newId = created[j].id;
      for (const l of linesByTx[t.id]) {
        lineRows.push({
          ...pick(l, ['direction', 'amount', 'currency', 'fx_rate', 'base_amount', 'description']),
          transaction_id: newId,
          account_id: accMap[l.account_id],
          category_id: l.category_id ? catMap[l.category_id] || null : null,
        });
      }
      for (const tg of tagsByTx[t.id] || []) if (tagMap[tg]) tagRows.push({ transaction_id: newId, tag_id: tagMap[tg] });
    });
    await insertRows('transaction_lines', lineRows, 'id');
    if (tagRows.length) await insertRows('transaction_tags', tagRows, 'transaction_id');
    report.transactions += chunk.length;
    onProgress(`Transactions… ${report.transactions}/${todoTx.length}`);
  }
  return report;
}

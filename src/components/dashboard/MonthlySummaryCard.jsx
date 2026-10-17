import { useMemo, useState } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatMoney } from '../../lib/formatters';

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function summarize(transactions, key) {
  let income = 0;
  let expense = 0;
  let count = 0;
  const byCat = new Map();
  let biggest = null;

  for (const tx of transactions) {
    if (!tx || tx.deleted_at || tx.status === 'pending' || tx.is_foreign) continue;
    if (String(tx.date || '').slice(0, 7) !== key) continue;
    if (tx.type !== 'expense' && tx.type !== 'income') continue;
    count += 1;
    let txTotal = 0;
    for (const line of tx.lines || []) {
      const amt = parseFloat(line.base_amount ?? line.amount ?? 0) || 0;
      if (tx.type === 'expense' && line.direction === 'out') {
        expense += amt;
        txTotal += amt;
        const name = line.category?.name || 'Uncategorized';
        const cur = byCat.get(name) || { name, icon: line.category?.icon || '', total: 0 };
        cur.total += amt;
        byCat.set(name, cur);
      } else if (tx.type === 'income' && line.direction === 'in') {
        income += amt;
      }
    }
    if (tx.type === 'expense' && (!biggest || txTotal > biggest.amount)) {
      biggest = { amount: txTotal, name: tx.payee_name || 'Unlabeled' };
    }
  }
  const top = [...byCat.values()].sort((a, b) => b.total - a.total);
  return { income, expense, saved: income - expense, count, top, biggest };
}

export default function MonthlySummaryCard() {
  const { transactions } = useTransactions();
  const { currentWorkspace } = useWorkspace();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [which, setWhich] = useState('this'); // 'this' | 'last'

  const currency = currentWorkspace?.base_currency || 'USD';
  const numberFormat = profile?.numberFormat || 'intl';
  const money = (n) => formatMoney(n, currency, numberFormat);

  const { label, current, previous } = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() - (which === 'last' ? 1 : 0), 1);
    const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    return {
      label: `${MONTH_NAMES[base.getMonth()]} ${base.getFullYear()}`,
      current: summarize(transactions, monthKey(base)),
      previous: summarize(transactions, monthKey(prev)),
    };
  }, [transactions, which]);

  const change =
    previous.expense > 0 ? Math.round(((current.expense - previous.expense) / previous.expense) * 100) : null;
  const top = current.top[0];

  const text = useMemo(() => {
    const lines = [
      `📊 *${label} Summary*`,
      '',
      `💸 Expense: ${money(current.expense)}`,
      `💰 Income: ${money(current.income)}`,
      `${current.saved >= 0 ? '🟢 Net Savings' : '🔴 Net Deficit'}: ${money(Math.abs(current.saved))}`,
    ];
    if (top) lines.push(`🏆 Top Category: ${top.icon ? `${top.icon} ` : ''}${top.name} (${money(top.total)})`);
    if (change !== null) lines.push(`${change > 0 ? '📈' : '📉'} Expenses are ${Math.abs(change)}% ${change > 0 ? 'higher' : 'lower'} than previous month`);
    lines.push('', `— Next Expenses`);
    return lines.join('\n');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, current, top, change, currency, numberFormat]);

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const shareNative = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${label} summary`, text });
        return;
      }
    } catch {
      return; // user cancelled
    }
    copy();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: 'Summary copied to clipboard', duration: 2500 });
    } catch {
      showToast({ message: 'Failed to copy summary', tone: 'error', duration: 2500 });
    }
  };

  const empty = current.count === 0;
  const pill = (active) => ({
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    border: '1px solid rgba(148,163,184,0.4)',
    background: active ? 'var(--md-primary, #6366f1)' : 'transparent',
    color: active ? 'var(--md-on-primary, #fff)' : 'inherit',
    cursor: 'pointer',
    fontSize: '0.8rem',
  });

  return (
    <section className="panel glass-card" aria-label="Monthly summary" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>📊 {label}</h3>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button type="button" style={pill(which === 'this')} onClick={() => setWhich('this')}>This Month</button>
          <button type="button" style={pill(which === 'last')} onClick={() => setWhich('last')}>Last Month</button>
        </div>
      </div>

      {empty ? (
        <p style={{ opacity: 0.7, margin: '0.9rem 0 0' }}>No transactions recorded for this period yet.</p>
      ) : (
        <>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.6, margin: '0.9rem 0 0.4rem' }}>
            {which === 'this' ? 'This month' : 'Last month'}, total spending is <b>{money(current.expense)}</b>,{' '}
            {current.saved >= 0 ? <>saved <b style={{ color: '#16a34a' }}>{money(current.saved)}</b></> : <>exceeded income by <b style={{ color: '#dc2626' }}>{money(-current.saved)}</b></>}
            {top && <>, top expense in <b>{top.icon ? `${top.icon} ` : ''}{top.name}</b> ({money(top.total)}).</>}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.85rem', opacity: 0.85 }}>
            <span>💰 Income: {money(current.income)}</span>
            <span>🧾 {current.count} entries</span>
            {current.biggest && <span>🔝 Largest: {current.biggest.name} ({money(current.biggest.amount)})</span>}
            {change !== null && <span>{change > 0 ? '📈' : '📉'} {Math.abs(change)}% {change > 0 ? 'higher' : 'lower'} than previous month</span>}
          </div>
          {current.top.length > 1 && (
            <div style={{ marginTop: '0.8rem', display: 'grid', gap: '0.35rem' }}>
              {current.top.slice(0, 4).map((c) => (
                <div key={c.name} style={{ fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{c.icon ? `${c.icon} ` : ''}{c.name}</span>
                    <span>{money(c.total)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 9999, background: 'rgba(148,163,184,0.25)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (c.total / (current.expense || 1)) * 100)}%`, height: '100%', background: 'var(--md-primary, #6366f1)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button type="button" className="submit-btn" style={{ width: 'auto', padding: '0.5rem 0.9rem' }} onClick={shareWhatsApp}>📲 Share via WhatsApp</button>
            <button type="button" className="secondary-btn" style={{ padding: '0.5rem 0.9rem' }} onClick={shareNative}>↗ Share</button>
            <button type="button" className="secondary-btn" style={{ padding: '0.5rem 0.9rem' }} onClick={copy}>📋 Copy</button>
          </div>
        </>
      )}
    </section>
  );
}

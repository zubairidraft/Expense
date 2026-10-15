import { Capacitor } from '@capacitor/core';

const PREF_KEY = 'expense_local_reminders';
const NOTIFIED_KEY = 'expense_notified_alerts';
const REMINDER_HOUR = 9; // 9:00 AM local time

export const isLocalReminderEnabled = () => {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
};

export const setLocalReminderEnabled = (on) => {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
};

// Stable positive 31-bit integer id from a string (Android needs numeric ids)
const hashId = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483000 + 1;
};

const atNine = (isoDate, daysBefore = 0) => {
  const [y, m, d] = String(isoDate).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d - daysBefore, REMINDER_HOUR, 0, 0, 0);
};

const readNotified = () => {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]');
  } catch {
    return [];
  }
};
const writeNotified = (list) => {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(list.slice(-300)));
  } catch {
    /* ignore */
  }
};

export const canUseNativeReminders = () => Capacitor.isNativePlatform();

export async function ensureReminderPermission() {
  if (!Capacitor.isNativePlatform()) return false;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
    perm = await LocalNotifications.requestPermissions();
  }
  return perm.display === 'granted';
}

/**
 * items: [{ key, title, body, dueDate (YYYY-MM-DD), daysBefore: number[] }]
 * budgetAlerts: [{ key, title, body }]  (shown once, right away)
 */
export async function syncLocalReminders({ items = [], budgetAlerts = [] }) {
  if (!Capacitor.isNativePlatform() || !isLocalReminderEnabled()) return;
  try {
    const granted = await ensureReminderPermission();
    if (!granted) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Remove our previously scheduled reminders and rebuild
    const pending = await LocalNotifications.getPending();
    const ours = (pending.notifications || []).filter((n) => n.extra?.kind === 'reminder');
    if (ours.length) {
      await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    }

    const now = Date.now();
    const horizon = now + 30 * 24 * 3600 * 1000;
    const toSchedule = [];
    items.forEach((it) => {
      (it.daysBefore || [0]).forEach((db) => {
        const at = atNine(it.dueDate, db);
        if (!at || at.getTime() <= now || at.getTime() > horizon) return;
        toSchedule.push({
          id: hashId(`${it.key}:${db}`),
          title: it.title,
          body: db === 0 ? it.body : `${it.body} (${db} din baqi)`,
          schedule: { at, allowWhileIdle: true },
          extra: { kind: 'reminder' },
        });
      });
    });

    // Budget alerts: notify once per alert key
    const notified = readNotified();
    const fresh = budgetAlerts.filter((a) => !notified.includes(a.key));
    fresh.forEach((a, idx) => {
      toSchedule.push({
        id: hashId(`budget:${a.key}`),
        title: a.title,
        body: a.body,
        schedule: { at: new Date(now + 2000 + idx * 500), allowWhileIdle: true },
        extra: { kind: 'reminder' },
      });
    });
    if (fresh.length) writeNotified([...notified, ...fresh.map((a) => a.key)]);

    if (toSchedule.length) {
      await LocalNotifications.schedule({ notifications: toSchedule.slice(0, 60) });
    }
  } catch (err) {
    console.warn('[Reminders] Could not sync local notifications:', err?.message || err);
  }
}

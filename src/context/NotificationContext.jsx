import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './AuthContext';
import { useBudgets } from './BudgetContext';
import { useRecurring } from './RecurringContext';
import { useSharedDebts } from './SharedDebtsContext';
import { syncLocalReminders } from '../lib/localReminders';

const NotificationContext = createContext(null);
const EMPTY = [];

export function NotificationProvider({ children }) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { budgets } = useBudgets();
  const { recurringProfiles } = useRecurring();
  const sharedDebts = useSharedDebts();
  const debts = sharedDebts?.debts || EMPTY;
  const contacts = sharedDebts?.contacts || EMPTY;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  // Synthetic (computed) alerts have no DB row; remember which ones the user dismissed
  const [dismissedSynthetic, setDismissedSynthetic] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('expense_pro_dismissed_alerts') || '[]');
    } catch {
      return [];
    }
  });
  const dismissSynthetic = (ids) => {
    setDismissedSynthetic((prev) => {
      const next = Array.from(new Set([...prev, ...ids])).slice(-500);
      try {
        localStorage.setItem('expense_pro_dismissed_alerts', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Fetch notifications for workspace
  const isRealWorkspace = Boolean(user && currentWorkspace?.id && currentWorkspace.id !== 'guest-space');

  const fetchNotifications = useCallback(async () => {
    if (!user || !currentWorkspace?.id || currentWorkspace.id === 'guest-space') {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.warn('Could not load notifications from DB, using local state:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark single notification as read
  const markAsRead = async (id) => {
    if (!notifications.some((n) => n.id === id)) {
      dismissSynthetic([id]);
      return;
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    );
    if (!isRealWorkspace || String(id).startsWith('local-')) return;
    try {
      await supabase.rpc('mark_notification_read', { p_notification_id: id });
    } catch (err) {
      console.warn('RPC mark_notification_read fallback:', err);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    dismissSynthetic(syntheticAlerts.map((a) => a.id));
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );
    if (!isRealWorkspace) return;
    try {
      await supabase.rpc('mark_all_notifications_read', { p_workspace_id: currentWorkspace.id });
    } catch (err) {
      console.warn('RPC mark_all_notifications_read fallback:', err);
    }
  };

  // Create notification
  const createNotification = async ({ type, title, message, actionUrl, metadata }) => {
    const newNotif = {
      id: `local-notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      workspace_id: currentWorkspace?.id,
      user_id: user?.id || null,
      type: type || 'system',
      title,
      message,
      is_read: false,
      action_url: actionUrl || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    };

    setNotifications((prev) => [newNotif, ...prev]);

    if (isRealWorkspace) {
      try {
        const { data } = await supabase
          .from('notifications')
          .insert({
            workspace_id: currentWorkspace.id,
            user_id: user?.id || null,
            type: newNotif.type,
            title,
            message,
            action_url: actionUrl || null,
            metadata: metadata || {},
          })
          .select()
          .single();

        if (data) {
          setNotifications((prev) => prev.map((n) => (n.id === newNotif.id ? data : n)));
        }
      } catch (err) {
        console.warn('Error inserting notification to DB:', err);
      }
    }
  };

  // Synthetic local threshold alerts: budgets (at each budget's own threshold, default 80%),
  // bills due soon, and loans / udhaar due or overdue
  const syntheticAlerts = useMemo(() => {
    const alerts = [];
    const periodTag = new Date().toISOString().slice(0, 7); // re-alert each month

    // Budgets
    budgets.forEach((b) => {
      const spent = parseFloat(b.spent || 0);
      const limit = parseFloat(b.amount || 0);
      const threshold = Number(b.alert_threshold) > 0 ? Number(b.alert_threshold) : 80;
      const label = b.category_name || b.categories?.name || b.name || 'Category';
      if (limit > 0) {
        const pct = (spent / limit) * 100;
        if (pct >= 100) {
          alerts.push({
            id: `budget-exceeded-${b.id}-${periodTag}`,
            type: 'budget_exceeded',
            title: `Budget khatam: ${label}`,
            message: `Kharcha ${pct.toFixed(0)}% ho gaya (${spent.toFixed(2)} / ${limit.toFixed(2)}).`,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        } else if (pct >= threshold) {
          alerts.push({
            id: `budget-warn-${b.id}-${periodTag}`,
            type: 'budget_warning',
            title: `Budget ${threshold}% par: ${label}`,
            message: `Kharcha ${pct.toFixed(0)}% tak pahunch gaya (${spent.toFixed(2)} / ${limit.toFixed(2)}).`,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const dayDiff = (iso) => {
      const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
      return Math.round((new Date(y, m - 1, d) - startOfToday) / 86400000);
    };

    // Recurring bills (honour each bill's own reminder window, default 3 days)
    recurringProfiles.forEach((r) => {
      if (r.next_due_date && r.active !== false && r.is_active !== false) {
        const diffDays = dayDiff(r.next_due_date);
        const window = Number(r.reminder_days_before) >= 0 && r.reminder_days_before != null ? Number(r.reminder_days_before) : 3;
        if (diffDays >= 0 && diffDays <= Math.max(window, 1)) {
          alerts.push({
            id: `bill-due-${r.id}-${r.next_due_date}`,
            type: 'bill_due',
            title: `${r.type === 'income' ? 'Income' : 'Bill'} aane wala hai: ${r.title}`,
            message: `${diffDays === 0 ? 'Aaj' : `${diffDays} din mein`} due hai, amount ${r.amount}.`,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        } else if (diffDays < 0 && diffDays >= -7 && r.type !== 'income') {
          alerts.push({
            id: `bill-overdue-${r.id}-${r.next_due_date}`,
            type: 'bill_due',
            title: `Bill late: ${r.title}`,
            message: `${Math.abs(diffDays)} din pehle due tha, amount ${r.amount}.`,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    });

    // Loans / udhaar
    debts.forEach((d) => {
      if (!d.due_date || d.status === 'settled' || d.status === 'written_off') return;
      const rem = parseFloat(d.remaining_amount || 0);
      if (rem <= 0) return;
      const diffDays = dayDiff(d.due_date);
      if (diffDays > 3) return;
      const who = contacts.find((c) => c.id === d.contact_id)?.name || 'Contact';
      const lent = d.direction === 'lent';
      const when = diffDays < 0 ? `${Math.abs(diffDays)} din se late hai` : diffDays === 0 ? 'aaj due hai' : `${diffDays} din mein due hai`;
      alerts.push({
        id: `debt-due-${d.id}-${d.due_date}`,
        type: 'debt_due',
        title: lent ? `Udhaar wapsi: ${who}` : `Udhaar dena hai: ${who}`,
        message: `${rem.toFixed(2)} ${d.currency || ''} ${when}.`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    });

    return alerts;
  }, [budgets, recurringProfiles, debts, contacts]);

  // Android phone notifications (no-op in the browser)
  useEffect(() => {
    if (!isRealWorkspace) return;
    const items = [];
    recurringProfiles.forEach((r) => {
      if (!r.next_due_date || r.active === false || r.is_active === false) return;
      const before = Number(r.reminder_days_before) > 0 ? Number(r.reminder_days_before) : 1;
      items.push({
        key: `bill:${r.id}:${r.next_due_date}`,
        title: `${r.type === 'income' ? 'Income' : 'Bill'}: ${r.title}`,
        body: `Aaj due hai — ${r.amount}`,
        dueDate: r.next_due_date,
        daysBefore: [0, before],
      });
    });
    debts.forEach((d) => {
      if (!d.due_date || d.status === 'settled' || d.status === 'written_off') return;
      const rem = parseFloat(d.remaining_amount || 0);
      if (rem <= 0) return;
      const who = contacts.find((c) => c.id === d.contact_id)?.name || 'Contact';
      items.push({
        key: `debt:${d.id}:${d.due_date}`,
        title: d.direction === 'lent' ? `Udhaar wapsi: ${who}` : `Udhaar dena hai: ${who}`,
        body: `Aaj due hai — ${rem.toFixed(2)} ${d.currency || ''}`,
        dueDate: d.due_date,
        daysBefore: [0, 2],
      });
    });
    const budgetAlerts = syntheticAlerts
      .filter((a) => a.type === 'budget_warning' || a.type === 'budget_exceeded')
      .map((a) => ({ key: a.id, title: a.title, body: a.message }));
    syncLocalReminders({ items, budgetAlerts });
  }, [isRealWorkspace, recurringProfiles, debts, contacts, syntheticAlerts]);

  const allNotifications = useMemo(() => {
    const combined = [...notifications];
    // Deduplicate synthetic alerts against existing notifications
    syntheticAlerts.forEach((alert) => {
      if (!combined.some((n) => n.id === alert.id || (n.title === alert.title && !n.is_read))) {
        combined.push(dismissedSynthetic.includes(alert.id) ? { ...alert, is_read: true } : alert);
      }
    });
    return combined;
  }, [notifications, syntheticAlerts, dismissedSynthetic]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !n.is_read).length;
  }, [allNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications: allNotifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        createNotification,
        refreshNotifications: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

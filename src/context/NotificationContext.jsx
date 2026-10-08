import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './AuthContext';
import { useBudgets } from './BudgetContext';
import { useRecurring } from './RecurringContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { budgets } = useBudgets();
  const { recurringProfiles } = useRecurring();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch notifications for workspace
  const fetchNotifications = useCallback(async () => {
    if (!currentWorkspace?.id) return;
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
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark single notification as read
  const markAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    );
    try {
      await supabase.rpc('mark_notification_read', { p_notification_id: id });
    } catch (err) {
      console.warn('RPC mark_notification_read fallback:', err);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );
    if (!currentWorkspace?.id) return;
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

    if (currentWorkspace?.id) {
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

  // Synthetic local threshold alerts (e.g. budgets over 80% or 100%, recurring due soon)
  const syntheticAlerts = useMemo(() => {
    const alerts = [];

    // Check budgets
    budgets.forEach((b) => {
      const spent = parseFloat(b.spent || 0);
      const limit = parseFloat(b.amount || 0);
      if (limit > 0) {
        const pct = (spent / limit) * 100;
        if (pct >= 100) {
          alerts.push({
            id: `budget-exceeded-${b.id}`,
            type: 'budget_exceeded',
            title: `Budget Exceeded: ${b.name || 'Category'}`,
            message: `Spending reached ${pct.toFixed(0)}% (${spent.toFixed(2)} / ${limit.toFixed(2)}).`,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        } else if (pct >= 85) {
          alerts.push({
            id: `budget-warn-${b.id}`,
            type: 'budget_warning',
            title: `Budget Warning: ${b.name || 'Category'}`,
            message: `Spending reached ${pct.toFixed(0)}% of envelope limit.`,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    });

    // Check recurring due within 3 days
    const now = new Date();
    recurringProfiles.forEach((r) => {
      if (r.next_due_date && r.is_active !== false) {
        const dueDate = new Date(r.next_due_date);
        const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 3) {
          alerts.push({
            id: `bill-due-${r.id}`,
            type: 'bill_due',
            title: `Upcoming ${r.type === 'income' ? 'Income' : 'Bill'}: ${r.title}`,
            message: `Due in ${diffDays === 0 ? 'today' : `${diffDays} day(s)`} for amount ${r.amount}.`,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    });

    return alerts;
  }, [budgets, recurringProfiles]);

  const allNotifications = useMemo(() => {
    const combined = [...notifications];
    // Deduplicate synthetic alerts against existing notifications
    syntheticAlerts.forEach((alert) => {
      if (!combined.some((n) => n.id === alert.id || (n.title === alert.title && !n.is_read))) {
        combined.push(alert);
      }
    });
    return combined;
  }, [notifications, syntheticAlerts]);

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

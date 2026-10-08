import { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';

export default function NotificationCenterModal({ isOpen, onClose }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'budgets' | 'bills'

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'budgets') return n.type?.startsWith('budget');
    if (filter === 'bills') return n.type === 'bill_due' || n.type === 'debt_due';
    return true;
  });

  const getIconForType = (type) => {
    switch (type) {
      case 'budget_exceeded':
        return '🚨';
      case 'budget_warning':
        return '⚠️';
      case 'bill_due':
        return '📅';
      case 'debt_due':
        return '💰';
      case 'spending_anomaly':
        return '⚡';
      default:
        return '🔔';
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🔔</span>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
              Notifications & Alerts
            </h2>
            {unreadCount > 0 && (
              <span
                style={{
                  background: 'var(--danger-color, #ef4444)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.3rem 0.6rem' }}>
            ✕
          </button>
        </div>

        {/* Filter Toolbar & Mark All Read */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className={`btn-secondary ${filter === 'all' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.8rem' }}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`btn-secondary ${filter === 'unread' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.8rem' }}
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </button>
            <button
              className={`btn-secondary ${filter === 'budgets' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.8rem' }}
              onClick={() => setFilter('budgets')}
            >
              Budgets
            </button>
            <button
              className={`btn-secondary ${filter === 'bills' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.8rem' }}
              onClick={() => setFilter('bills')}
            >
              Bills & Debts
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              className="btn-secondary"
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
              onClick={markAllAsRead}
            >
              Mark All Read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.25rem' }}>
          {filteredNotifications.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🔕</span>
              No notifications to display in this view.
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: notif.is_read ? 'var(--bg-secondary, rgba(255,255,255,0.02))' : 'rgba(99, 102, 241, 0.08)',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: '1.25rem', lineHeight: '1.2' }}>{getIconForType(notif.type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: notif.is_read ? '500' : '700', color: 'var(--text-primary)' }}>
                      {notif.title}
                    </h4>
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--primary-color, #6366f1)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          padding: '0.1rem 0.3rem',
                        }}
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {notif.message}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.35rem' }}>
                    {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

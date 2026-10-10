import Icon from '../ui/Icon';

export default function CustomizeWidgetsModal({
  isOpen,
  onClose,
  widgets,
  onToggleWidget,
  onResetWidgets,
}) {
  if (!isOpen) return null;

  const coreWidgets = widgets.filter((w) => !w.isAccountWidget && !w.id.startsWith('account_bal_'));
  const accountWidgets = widgets.filter((w) => w.isAccountWidget || w.id.startsWith('account_bal_'));

  const renderWidgetRow = (widget) => (
    <div
      key={widget.id}
      onClick={() => onToggleWidget(widget.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 1rem',
        borderRadius: '10px',
        background: widget.enabled
          ? 'rgba(var(--md-primary-rgb), 0.08)'
          : 'var(--bg-main, rgba(0,0,0,0.1))',
        border: widget.enabled
          ? '1px solid rgba(var(--md-primary-rgb), 0.3)'
          : '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.06))',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        <span
          style={{
            display: 'inline-flex',
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--md-secondary-container)',
            color: 'var(--md-on-secondary-container)',
            fontSize: widget.account?.icon ? '1.25rem' : 'inherit',
            flexShrink: 0,
          }}
        >
          {widget.account?.icon ? widget.account.icon : <Icon name={widget.icon || 'widgets'} size={22} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {widget.label}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {widget.description}
          </div>
        </div>
      </div>

      {/* Styled Toggle Pill */}
      <div
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          background: widget.enabled ? 'var(--color-primary, var(--md-primary))' : 'rgba(100, 116, 139, 0.3)',
          position: 'relative',
          transition: 'background 0.2s ease',
          flexShrink: 0,
          marginLeft: '0.75rem',
        }}
      >
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#ffffff',
            position: 'absolute',
            top: '3px',
            left: widget.enabled ? '23px' : '3px',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">Dashboard Widgets</h2>
            <p className="modal-subtitle">
              Choose which reporting modules and separate account balances appear on your home dashboard.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '460px', overflowY: 'auto', padding: '0.5rem 0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Core Dashboard Modules
          </div>
          {coreWidgets.map(renderWidgetRow)}

          {accountWidgets.length > 0 && (
            <>
              <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle, rgba(var(--md-on-surface-rgb), 0.08))' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Individual Account Balance Cards
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', marginBottom: '0.65rem' }}>
                  Toggle separate cards to monitor specific accounts independently on your dashboard.
                </div>
              </div>
              {accountWidgets.map(renderWidgetRow)}
            </>
          )}
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onResetWidgets}
            style={{ fontSize: '0.82rem' }}
          >
            ↺ Reset Defaults
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ minWidth: '100px' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

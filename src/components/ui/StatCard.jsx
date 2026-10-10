import Icon, { ICON_NAMES } from './Icon';

// Map legacy emoji icons to Material Symbols
const EMOJI_ICON = {
  '💎': 'account_balance', '📈': 'trending_up', '📉': 'trending_down', '🎯': 'target', '🏦': 'account_balance',
  '💳': 'credit_card', '💰': 'payments', '💵': 'payments', '🧾': 'receipt_long', '⏳': 'schedule', '🔁': 'event_repeat',
  '📅': 'calendar_month', '🤝': 'handshake', '📥': 'download', '📤': 'upload', '💼': 'work', '📊': 'monitoring',
  '⚡': 'bolt', '🔥': 'trending_up', '🛡️': 'lock', '⚠️': 'warning', '✅': 'check_circle', '🏷️': 'sell', '🏪': 'storefront',
  '📁': 'category', '🌐': 'language', '🧮': 'balance', '💹': 'query_stats', '🪙': 'savings', '🏢': 'business', '🔮': 'auto_awesome', '📦': 'category', '🏆': 'star', '⚖️': 'balance',
};

function StatIcon({ icon }) {
  if (!icon) return null;
  const name = ICON_NAMES.includes(icon) ? icon : EMOJI_ICON[icon];
  return <span className="stat-icon">{name ? <Icon name={name} size={22} /> : icon}</span>;
}

export default function StatCard({
  title,
  icon,
  value,
  meta,
  variant = 'default', // 'default' | 'income' | 'expense' | 'balance'
  onClick,
}) {
  return (
    <div className={`stat-card ${variant}`} onClick={onClick}>
      <div className="stat-header">
        <span className="stat-label">{title}</span>
        <StatIcon icon={icon} />
      </div>
      <div className={`stat-value ${variant}`}>
        {value}
      </div>
      {meta && <div className="stat-meta">{meta}</div>}
    </div>
  );
}

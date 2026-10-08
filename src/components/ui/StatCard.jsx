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
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className={`stat-value ${variant}`}>
        {value}
      </div>
      {meta && <div className="stat-meta">{meta}</div>}
    </div>
  );
}

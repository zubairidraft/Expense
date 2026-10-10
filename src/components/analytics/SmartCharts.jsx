import { useState, useMemo } from 'react';

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#e11d48',
];

/**
 * Smart Dual-Bar Inflows vs Outflows Chart
 */
export function CashFlowBarChart({ data = [], currency = 'USD' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const chartData = useMemo(() => {
    if (!data.length) return [];
    return data.slice(-6); // Last 6 months
  }, [data]);

  const maxVal = useMemo(() => {
    let m = 100;
    chartData.forEach((d) => {
      const inc = parseFloat(d.total_income || 0);
      const exp = parseFloat(d.total_expense || 0);
      if (inc > m) m = inc;
      if (exp > m) m = exp;
    });
    return m * 1.15; // 15% headroom
  }, [chartData]);

  if (!chartData.length) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No cash flow data available to render chart.
      </div>
    );
  }

  const svgWidth = 600;
  const svgHeight = 240;
  const paddingX = 40;
  const paddingY = 30;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingY * 2;
  const barGroupWidth = plotWidth / chartData.length;
  const barWidth = Math.min(24, barGroupWidth * 0.32);

  return (
    <div className="smart-chart-container" style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.25rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--md-success)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Income</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--md-error)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Expenses</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--md-success)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--md-success)" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--md-error)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--md-error)" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const y = paddingY + plotHeight * (1 - pct);
          const val = (maxVal * pct).toFixed(0);
          return (
            <g key={idx}>
              <line
                x1={paddingX}
                y1={y}
                x2={svgWidth - paddingX}
                y2={y}
                stroke="var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))"
                strokeDasharray={pct === 0 ? 'none' : '3,3'}
                strokeWidth="1"
              />
              <text
                x={paddingX - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="var(--text-secondary, var(--md-on-surface-variant))"
              >
                ${val}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {chartData.map((d, idx) => {
          const inc = parseFloat(d.total_income || 0);
          const exp = parseFloat(d.total_expense || 0);
          const incHeight = (inc / maxVal) * plotHeight;
          const expHeight = (exp / maxVal) * plotHeight;

          const groupCenterX = paddingX + idx * barGroupWidth + barGroupWidth / 2;
          const incX = groupCenterX - barWidth - 2;
          const expX = groupCenterX + 2;

          const incY = paddingY + plotHeight - incHeight;
          const expY = paddingY + plotHeight - expHeight;

          const monthLabel = d.month_date
            ? new Date(d.month_date).toLocaleDateString('default', { month: 'short' })
            : `M${idx + 1}`;

          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Highlight Backdrop */}
              {isHovered && (
                <rect
                  x={paddingX + idx * barGroupWidth + 4}
                  y={paddingY}
                  width={barGroupWidth - 8}
                  height={plotHeight}
                  fill="rgba(var(--md-primary-rgb), 0.08)"
                  rx="4"
                />
              )}

              {/* Income Bar */}
              <rect
                x={incX}
                y={incY}
                width={barWidth}
                height={Math.max(incHeight, 2)}
                fill="url(#incomeGrad)"
                rx="3"
                opacity={isHovered ? 1 : 0.88}
                style={{ transition: 'all 0.2s ease' }}
              />

              {/* Expense Bar */}
              <rect
                x={expX}
                y={expY}
                width={barWidth}
                height={Math.max(expHeight, 2)}
                fill="url(#expenseGrad)"
                rx="3"
                opacity={isHovered ? 1 : 0.88}
                style={{ transition: 'all 0.2s ease' }}
              />

              {/* Month Label */}
              <text
                x={groupCenterX}
                y={svgHeight - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight={isHovered ? '700' : '500'}
                fill={isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'}
              >
                {monthLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip Hover Overlay */}
      {hoveredIdx !== null && chartData[hoveredIdx] && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            background: 'var(--bg-main, rgba(var(--md-surface-rgb), 0.95))',
            border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {new Date(chartData[hoveredIdx].month_date).toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </span>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <span style={{ color: 'var(--md-success)', fontWeight: 600 }}>
              +${parseFloat(chartData[hoveredIdx].total_income).toFixed(2)}
            </span>
            <span style={{ color: 'var(--md-error)', fontWeight: 600 }}>
              -${parseFloat(chartData[hoveredIdx].total_expense).toFixed(2)}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Net: ${parseFloat(chartData[hoveredIdx].net_cash_flow).toFixed(2)} ({chartData[hoveredIdx].savings_rate_percent}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Smart Interactive Category Donut Chart
 */
export function CategoryDonutChart({ data = [], currency = 'USD' }) {
  const [activeSlice, setActiveSlice] = useState(null);

  const totalSpent = useMemo(() => {
    return data.reduce((sum, d) => sum + parseFloat(d.total_spent || d.amount || 0), 0);
  }, [data]);

  const slices = useMemo(() => {
    if (!data.length || totalSpent <= 0) return [];

    let currentAngle = 0;
    return data.slice(0, 6).map((item, idx) => {
      const amt = parseFloat(item.total_spent || item.amount || 0);
      const fraction = amt / totalSpent;
      const angle = fraction * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      return {
        name: item.category_name || item.name || 'Other',
        amount: amt,
        percentage: (fraction * 100).toFixed(1),
        startAngle,
        endAngle,
        color: PALETTE[idx % PALETTE.length],
      };
    });
  }, [data, totalSpent]);

  // SVG arc generator helper
  const describeArc = (x, y, radius, innerRadius, startAngle, endAngle) => {
    const polarToCartesian = (centerX, centerY, r, angleInDegrees) => {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
      return {
        x: centerX + r * Math.cos(angleInRadians),
        y: centerY + r * Math.sin(angleInRadians),
      };
    };

    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const innerStart = polarToCartesian(x, y, innerRadius, endAngle);
    const innerEnd = polarToCartesian(x, y, innerRadius, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      'L', innerEnd.x, innerEnd.y,
      'A', innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
      'Z',
    ].join(' ');
  };

  if (!slices.length) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No category expenditure data to display.
      </div>
    );
  }

  const cx = 110;
  const cy = 110;
  const outerR = 95;
  const innerR = 60;

  const displayCenter = activeSlice !== null ? slices[activeSlice] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '2rem' }}>
      {/* Donut Graphic */}
      <div style={{ position: 'relative', width: '220px', height: '220px', flexShrink: 0 }}>
        <svg viewBox="0 0 220 220" style={{ width: '100%', height: '100%' }}>
          {slices.map((slice, idx) => {
            const isHovered = activeSlice === idx;
            const r = isHovered ? outerR + 4 : outerR;
            const ir = isHovered ? innerR - 2 : innerR;

            return (
              <path
                key={idx}
                d={describeArc(cx, cy, r, ir, slice.startAngle, Math.min(slice.endAngle, 359.99))}
                fill={slice.color}
                stroke="var(--bg-card, var(--md-surface-container))"
                strokeWidth="2"
                onMouseEnter={() => setActiveSlice(idx)}
                onMouseLeave={() => setActiveSlice(null)}
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              />
            );
          })}
        </svg>

        {/* Center Text Readout */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            maxWidth: '105px',
          }}
        >
          {displayCenter ? (
            <>
              <div style={{ fontSize: '0.72rem', color: displayCenter.color, fontWeight: 700, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayCenter.name}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {displayCenter.percentage}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                ${displayCenter.amount.toFixed(0)}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Total
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ${totalSpent.toFixed(0)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {slices.length} categories
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1', minWidth: '180px' }}>
        {slices.map((slice, idx) => (
          <div
            key={idx}
            onMouseEnter={() => setActiveSlice(idx)}
            onMouseLeave={() => setActiveSlice(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              background: activeSlice === idx ? 'rgba(var(--md-primary-rgb), 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: slice.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {slice.name}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                ${slice.amount.toFixed(2)}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>
                ({slice.percentage}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Smart Cash Flow Trajectory Curve
 */
export function CashFlowTrajectoryChart({ forecast = {}, currency = 'USD' }) {
  const curve = forecast.projectedCurve;

  // Hooks must run on every render (before any early return)
  // Downsample if curve has too many points (e.g. 90 points -> 25 points)
  const sampled = useMemo(() => {
    const pts = curve || [];
    if (pts.length <= 30) return pts;
    const step = Math.ceil(pts.length / 30);
    return pts.filter((_, idx) => idx % step === 0 || idx === pts.length - 1);
  }, [curve]);

  if (!curve || !curve.length) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Simulation data pending active recurring profiles.
      </div>
    );
  }

  const balances = sampled.map((p) => parseFloat(p.projectedBalance || 0));
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances, 100);
  const range = maxBal - minBal || 1;

  const width = 600;
  const height = 180;
  const padX = 30;
  const padY = 25;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const points = sampled.map((p, idx) => {
    const x = padX + (idx / (sampled.length - 1)) * plotW;
    const y = padY + plotH - ((parseFloat(p.projectedBalance) - minBal) / range) * plotH;
    return { x, y, ...p };
  });

  // Construct smooth SVG path
  const linePath = points.reduce((acc, pt, idx) => {
    if (idx === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[idx - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
  }, '');

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="forecastAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--md-primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--md-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Zero or Min Baseline */}
        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          stroke="var(--border-color, rgba(var(--md-on-surface-rgb), 0.1))"
          strokeWidth="1"
        />

        {/* Gradient Area Fill */}
        <path d={areaPath} fill="url(#forecastAreaGrad)" />

        {/* Trajectory Curve Line */}
        <path d={linePath} fill="none" stroke="var(--md-primary)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Key Milestone Nodes */}
        {points.map((pt, idx) => {
          if (idx === 0 || idx === points.length - 1 || idx === Math.floor(points.length / 2)) {
            return (
              <g key={idx}>
                <circle cx={pt.x} cy={pt.y} r="4" fill="var(--md-primary)" stroke="var(--md-on-primary)" strokeWidth="2" />
                <text
                  x={pt.x}
                  y={pt.y - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--text-primary)"
                >
                  ${parseFloat(pt.projectedBalance).toFixed(0)}
                </text>
                <text
                  x={pt.x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--text-secondary)"
                >
                  {pt.date?.slice(5)}
                </text>
              </g>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}

/**
 * Smart Radial Burn Velocity Gauge
 */
export function BurnRateGaugeChart({ velocity = {}, currency = 'USD' }) {
  const dailyBurn = parseFloat(velocity.dailyBurnRate || 0);
  const safeDaily = parseFloat(velocity.safeDailyRemainingBudget || 0);
  const isOnTrack = velocity.isOnTrack !== false;

  const pct = safeDaily > 0 ? Math.min(100, (dailyBurn / safeDaily) * 100) : 65;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ position: 'relative', width: '160px', height: '95px', overflow: 'hidden' }}>
        <svg viewBox="0 0 160 90" style={{ width: '100%', height: '100%' }}>
          {/* Background Arc */}
          <path
            d="M 20 80 A 60 60 0 0 1 140 80"
            fill="none"
            stroke="var(--border-color, rgba(var(--md-on-surface-rgb), 0.1))"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Progress Arc */}
          <path
            d="M 20 80 A 60 60 0 0 1 140 80"
            fill="none"
            stroke={isOnTrack ? 'var(--md-success)' : 'var(--md-error)'}
            strokeWidth="12"
            strokeDasharray="188.5"
            strokeDashoffset={188.5 * (1 - pct / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>

        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', textAlign: 'center' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            ${dailyBurn.toFixed(0)}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>
            / day burn
          </span>
        </div>
      </div>

      <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            background: isOnTrack ? 'rgba(var(--md-success-rgb), 0.15)' : 'rgba(var(--md-error-rgb), 0.15)',
            color: isOnTrack ? 'var(--md-success)' : 'var(--md-error)',
          }}
        >
          {isOnTrack ? '✓ On Budget' : '⚠️ Burn Warning'}
        </span>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
          Safe Daily Cap: ${safeDaily > 0 ? safeDaily.toFixed(2) : '350.00'}
        </div>
      </div>
    </div>
  );
}

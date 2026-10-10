import { useState } from 'react';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import MoneyDisplay from '../ui/MoneyDisplay';
import StatCard from '../ui/StatCard';
import {
  CashFlowBarChart,
  CategoryDonutChart,
  CashFlowTrajectoryChart,
  BurnRateGaugeChart,
} from './SmartCharts';

export default function AnalyticsView({ onOpenZakatModal }) {
  const { currentWorkspace } = useWorkspace();
  const {
    netWorth,
    cashFlowHistory,
    categorySpending,
    currentVelocity,
    spendingAnomalies,
    cashFlowForecast,
    forecastHorizon,
    setForecastHorizon,
  } = useAnalytics();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'anomalies' | 'forecast'
  const currency = currentWorkspace?.base_currency || 'USD';

  return (
    <div className="analytics-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header & Zakat Launcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            📈 Visual Analytics & Smart Forecasting
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Multi-horizon trend analytics, interactive SVG charts, burn velocity, and anomaly detection.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn-secondary"
            onClick={onOpenZakatModal}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem' }}
          >
            <span>🌙</span>
            <span>Zakat Calculator</span>
          </button>
        </div>
      </div>

      {/* Top 4 Key Metric Cards */}
      <div className="stats-grid">
        <StatCard
          title="Net Worth"
          icon="💎"
          variant="balance"
          value={<MoneyDisplay amount={netWorth.netWorth} currencyCode={currency} />}
          meta={`Assets: ${netWorth.totalAssets.toFixed(2)} | Liabilities: ${netWorth.totalLiabilities.toFixed(2)}`}
        />

        <StatCard
          title="Daily Burn Rate"
          icon="⚡"
          variant="expense"
          value={<MoneyDisplay amount={currentVelocity.dailyBurnRate} currencyCode={currency} />}
          meta={`Projected Month-End: ${currentVelocity.projectedMonthEnd} ${currency}`}
        />

        <StatCard
          title="Safe Daily Budget"
          icon="🛡️"
          variant={currentVelocity.isOnTrack ? 'income' : 'expense'}
          value={
            currentVelocity.safeDailyRemainingBudget ? (
              <MoneyDisplay amount={currentVelocity.safeDailyRemainingBudget} currencyCode={currency} />
            ) : (
              'No Budget Set'
            )
          }
          meta={
            currentVelocity.isOnTrack
              ? `${currentVelocity.remainingDays} days remaining on track`
              : `⚠️ Overspend Risk: ${currentVelocity.projectedOverspend} ${currency}`
          }
        />

        <StatCard
          title="Forecast Health"
          icon="🔮"
          variant={
            cashFlowForecast.riskLevel === 'healthy'
              ? 'income'
              : cashFlowForecast.riskLevel === 'warning'
              ? 'balance'
              : 'expense'
          }
          value={cashFlowForecast.riskLevel.toUpperCase()}
          meta={`Min balance: ${cashFlowForecast.minimumBalance} ${currency} on ${cashFlowForecast.minimumBalanceDate}`}
        />
      </div>

      {/* Tabs Switcher */}
      <div className="tabs-nav" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))', paddingBottom: '0.5rem' }}>
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Smart Charts & Trends
        </button>
        <button
          className={`tab-btn ${activeTab === 'forecast' ? 'active' : ''}`}
          onClick={() => setActiveTab('forecast')}
        >
          📈 Cash Flow Projection ({forecastHorizon} Days)
        </button>
        <button
          className={`tab-btn ${activeTab === 'anomalies' ? 'active' : ''}`}
          onClick={() => setActiveTab('anomalies')}
        >
          🚨 Spending Anomalies ({spendingAnomalies.length})
        </button>
      </div>

      {/* Tab 1: Smart Charts & Trends */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Dual Smart Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {/* Cash Flow Bar Chart */}
            <div className="card glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                    📈 Inflows vs Outflows Trends
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Interactive multi-month cash flow comparison
                  </span>
                </div>
              </div>
              <CashFlowBarChart data={cashFlowHistory} currency={currency} />
            </div>

            {/* Category Donut Chart */}
            <div className="card glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                    🍩 Category Expense Allocation
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Visual spending share by envelope
                  </span>
                </div>
              </div>
              <CategoryDonutChart data={categorySpending} currency={currency} />
            </div>
          </div>

          {/* Velocity Meter & History Table Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {/* Burn Rate Gauge */}
            <div className="card glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: 'var(--text-primary)', textAlign: 'center' }}>
                ⚡ Daily Spending Burn Velocity
              </h3>
              <BurnRateGaugeChart velocity={currentVelocity} currency={currency} />
            </div>

            {/* Monthly Ledger History */}
            <div className="card glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                🗓️ Monthly Cash Flow Summary
              </h3>
              {cashFlowHistory.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No monthly cash flow records available yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.6rem' }}>Month</th>
                        <th style={{ padding: '0.6rem' }}>Income</th>
                        <th style={{ padding: '0.6rem' }}>Expense</th>
                        <th style={{ padding: '0.6rem' }}>Net Cash Flow</th>
                        <th style={{ padding: '0.6rem' }}>Savings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashFlowHistory.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.6rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {new Date(row.month_date).toLocaleDateString('default', { month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '0.6rem', color: 'var(--md-success)', fontWeight: 600 }}>
                            +{parseFloat(row.total_income).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.6rem', color: 'var(--md-error)', fontWeight: 600 }}>
                            -{parseFloat(row.total_expense).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.6rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {parseFloat(row.net_cash_flow) >= 0 ? '+' : ''}{parseFloat(row.net_cash_flow).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            <span
                              style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.78rem',
                                background: parseFloat(row.savings_rate_percent) > 20 ? 'rgba(var(--md-success-rgb), 0.15)' : 'rgba(100, 116, 139, 0.15)',
                                color: parseFloat(row.savings_rate_percent) > 20 ? 'var(--md-success)' : 'var(--text-secondary)',
                                fontWeight: 600,
                              }}
                            >
                              {row.savings_rate_percent}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Cash Flow Projection Simulation */}
      {activeTab === 'forecast' && (
        <div className="card glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                📈 Cash Flow Trajectory Curve
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Simulates forward liquidity trajectory based on active recurring subscriptions, bills, and income.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[30, 60, 90].map((horizon) => (
                <button
                  key={horizon}
                  className={`btn-secondary ${forecastHorizon === horizon ? 'btn-primary' : ''}`}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                  onClick={() => setForecastHorizon(horizon)}
                >
                  {horizon} Days
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Trajectory SVG Chart */}
          <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-main, rgba(0,0,0,0.15))', border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' }}>
            <CashFlowTrajectoryChart forecast={cashFlowForecast} currency={currency} />
          </div>

          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              background: 'var(--bg-secondary, rgba(var(--md-on-surface-rgb), 0.03))',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Starting Liquidity</span>
              <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.2rem 0 0 0', color: 'var(--text-primary)' }}>
                {cashFlowForecast.startingBalance} {currency}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Projected End Balance</span>
              <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.2rem 0 0 0', color: 'var(--text-primary)' }}>
                {cashFlowForecast.endingBalance} {currency}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Lowest Projected Dip</span>
              <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.2rem 0 0 0', color: Number(cashFlowForecast.minimumBalance) < 0 ? 'var(--md-error)' : 'var(--md-success)' }}>
                {cashFlowForecast.minimumBalance} {currency}
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.6rem' }}>Date</th>
                  <th style={{ padding: '0.6rem' }}>Day</th>
                  <th style={{ padding: '0.6rem' }}>Scheduled Events</th>
                  <th style={{ padding: '0.6rem' }}>Daily Net Change</th>
                  <th style={{ padding: '0.6rem', textAlign: 'right' }}>Projected Balance</th>
                </tr>
              </thead>
              <tbody>
                {cashFlowForecast.projectedCurve.slice(0, 15).map((pt, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 500, color: 'var(--text-primary)' }}>{pt.date}</td>
                    <td style={{ padding: '0.6rem', color: 'var(--text-secondary)' }}>+{pt.dayIndex}d</td>
                    <td style={{ padding: '0.6rem' }}>
                      {pt.events.length > 0 ? (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {pt.events.map((ev, eIdx) => (
                            <span key={eIdx} style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(var(--md-primary-rgb), 0.15)', color: 'var(--md-primary)' }}>
                              {ev}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>None scheduled</span>
                      )}
                    </td>
                    <td style={{ padding: '0.6rem', color: parseFloat(pt.netDayChange) >= 0 ? 'var(--md-success)' : 'var(--md-error)', fontWeight: 600 }}>
                      {parseFloat(pt.netDayChange) >= 0 ? '+' : ''}{pt.netDayChange} {currency}
                    </td>
                    <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {pt.projectedBalance} {currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Spending Anomalies Radar */}
      {activeTab === 'anomalies' && (
        <div className="card glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Detected Outliers & Spikes
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Evaluates transactions &gt;2.2x category historical baseline
            </span>
          </div>

          {spendingAnomalies.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>✅</span>
              All spending patterns are consistent with your established category averages. No anomalies detected!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {spendingAnomalies.map((anomaly, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: anomaly.severity === 'high' ? 'rgba(var(--md-error-rgb), 0.08)' : 'rgba(var(--md-warning-rgb), 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{anomaly.payeeName}</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          background: anomaly.severity === 'high' ? 'var(--md-error)' : 'var(--md-warning)',
                          color: 'var(--md-on-primary)',
                        }}
                      >
                        {anomaly.severity} Spike ({anomaly.deviationMultiplier}x)
                      </span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {anomaly.reason} • Dated {anomaly.date}
                    </p>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--md-error)' }}>
                    {anomaly.amount} {currency}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

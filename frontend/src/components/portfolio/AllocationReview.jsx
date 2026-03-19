import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import "./AllocationReview.css";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48",
];

function SectorDonut({ sectorBreakdown }) {
  if (!sectorBreakdown || sectorBreakdown.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={sectorBreakdown}
          dataKey="weight"
          nameKey="sector"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          strokeWidth={0}
        >
          {sectorBreakdown.map((entry, i) => (
            <Cell key={entry.sector} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: "0.78rem",
            color: "var(--text)",
          }}
          formatter={(value) => `${value.toFixed(1)}%`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function HoldingsTable({ allocation }) {
  if (!allocation || allocation.length === 0) return null;

  return (
    <table className="review-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Sector</th>
          <th>Weight%</th>
          <th>Shares</th>
          <th>EVS</th>
        </tr>
      </thead>
      <tbody>
        {allocation.map((row) => (
          <tr key={row.ticker}>
            <td className="review-table__ticker">{row.ticker}</td>
            <td>{row.sector || "\u2014"}</td>
            <td className="review-table__weight">{(row.weight * 100).toFixed(1)}%</td>
            <td>{row.shares ?? "\u2014"}</td>
            <td>{row.evs_score ?? "\u2014"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RiskMetrics({ riskMetrics }) {
  if (!riskMetrics) return null;

  return (
    <div className="risk-metrics-bar">
      <div className="risk-metric">
        <div className="risk-metric__value risk-metric__value--green">
          {riskMetrics.expected_return != null
            ? `${(riskMetrics.expected_return * 100).toFixed(1)}%`
            : "\u2014"}
        </div>
        <div className="risk-metric__label">Est. Return</div>
      </div>
      <div className="risk-metric">
        <div className="risk-metric__value risk-metric__value--yellow">
          {riskMetrics.volatility != null
            ? `${(riskMetrics.volatility * 100).toFixed(1)}%`
            : "\u2014"}
        </div>
        <div className="risk-metric__label">Est. Volatility</div>
      </div>
      <div className="risk-metric">
        <div className="risk-metric__value risk-metric__value--blue">
          {riskMetrics.sharpe_ratio != null
            ? riskMetrics.sharpe_ratio.toFixed(2)
            : "\u2014"}
        </div>
        <div className="risk-metric__label">Sharpe Ratio</div>
      </div>
    </div>
  );
}

export default function AllocationReview({
  allocation,
  sectorBreakdown,
  riskMetrics,
  onRegenerate,
  onCreate,
  loading,
}) {
  return (
    <div className="allocation-review">
      <div className="allocation-review__title">Portfolio Allocation</div>

      <div className="review-grid">
        <div className="review-grid__chart">
          <SectorDonut sectorBreakdown={sectorBreakdown} />
        </div>
        <div className="review-grid__table-wrap">
          <HoldingsTable allocation={allocation} />
        </div>
      </div>

      <RiskMetrics riskMetrics={riskMetrics} />

      <div className="review-actions">
        <button
          type="button"
          className="review-actions__btn review-actions__btn--secondary"
          onClick={onRegenerate}
          disabled={loading}
        >
          Regenerate
        </button>
        <button
          type="button"
          className="review-actions__btn review-actions__btn--primary"
          onClick={onCreate}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Portfolio"}
        </button>
      </div>
    </div>
  );
}

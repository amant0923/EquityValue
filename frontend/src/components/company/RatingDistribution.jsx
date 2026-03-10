import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = {
  "Strong Buy": "#10b981",
  Buy: "#34d399",
  Hold: "#f59e0b",
  Sell: "#ef4444",
  "Strong Sell": "#dc2626",
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "var(--surface2)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "8px 12px",
      fontSize: "0.75rem",
      color: "var(--text)",
    }}>
      <span style={{ fontWeight: 700 }}>{d.label}</span>: {d.value} analyst{d.value !== 1 ? "s" : ""}
    </div>
  );
};

export default function RatingDistribution({ data }) {
  if (!data) return null;

  const ratings = [
    { label: "Strong Buy", value: data.strong_buy || 0 },
    { label: "Buy", value: data.buy || 0 },
    { label: "Hold", value: data.hold || 0 },
    { label: "Sell", value: data.sell || 0 },
    { label: "Strong Sell", value: data.strong_sell || 0 },
  ];

  const total = ratings.reduce((s, r) => s + r.value, 0);
  if (total === 0) return null;

  // Stacked horizontal bar data
  const stackedData = [
    {
      name: "Ratings",
      ...Object.fromEntries(ratings.map((r) => [r.label, r.value])),
    },
  ];

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 className="ci-section-title">Analyst Ratings</h3>
        {data.consensus && (
          <span className="ci-badge">{data.consensus}</span>
        )}
      </div>

      {/* Stacked horizontal bar */}
      <ResponsiveContainer width="100%" height={36}>
        <BarChart layout="vertical" data={stackedData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis type="number" hide domain={[0, total]} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          {ratings.map((r) => (
            <Bar
              key={r.label}
              dataKey={r.label}
              stackId="a"
              fill={COLORS[r.label]}
              radius={
                r.label === "Strong Buy"
                  ? [6, 0, 0, 6]
                  : r.label === "Strong Sell"
                  ? [0, 6, 6, 0]
                  : [0, 0, 0, 0]
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="rd-legend">
        {ratings.map(
          (r) =>
            r.value > 0 && (
              <span key={r.label} className="rd-legend-item">
                <span
                  className="rd-legend-dot"
                  style={{ background: COLORS[r.label] }}
                />
                {r.label}: {r.value}
              </span>
            )
        )}
        <span className="rd-legend-total">{total} total</span>
      </div>

      <style>{`
        .ci-section-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 12px;
        }
        .ci-badge {
          font-size: 0.65rem;
          padding: 2px 8px;
          border-radius: 6px;
          background: var(--surface2);
          color: var(--text3);
        }
        .rd-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 16px;
          margin-top: 12px;
          align-items: center;
        }
        .rd-legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          color: var(--text2);
        }
        .rd-legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .rd-legend-total {
          font-size: 0.68rem;
          color: var(--text3);
          margin-left: auto;
        }
      `}</style>
    </div>
  );
}

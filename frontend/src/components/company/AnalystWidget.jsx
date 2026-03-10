import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const RATING_COLORS = {
  "Strong Buy": "#10b981",
  "Buy": "#34d399",
  "Hold": "#f59e0b",
  "Sell": "#ef4444",
  "Strong Sell": "#dc2626",
};

export default function AnalystWidget({ analyst }) {
  if (!analyst) return null;

  const ratings = [
    { label: "Strong Buy", value: analyst.strong_buy || 0 },
    { label: "Buy", value: analyst.buy || 0 },
    { label: "Hold", value: analyst.hold || 0 },
    { label: "Sell", value: analyst.sell || 0 },
    { label: "Strong Sell", value: analyst.strong_sell || 0 },
  ];
  const totalRatings = ratings.reduce((s, r) => s + r.value, 0);

  const hasTargets = analyst.target_mean || analyst.target_high;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div className="aw-header">
        <h3 className="aw-title">Analyst Consensus</h3>
        {analyst.consensus && (
          <span className="aw-consensus-badge">{analyst.consensus}</span>
        )}
      </div>

      <div className="aw-grid">
        {/* Rating distribution */}
        {totalRatings > 0 && (
          <div className="aw-ratings">
            <div className="aw-bar-stack">
              {ratings.map((r) => (
                r.value > 0 && (
                  <div
                    key={r.label}
                    className="aw-bar-segment"
                    style={{
                      width: `${(r.value / totalRatings) * 100}%`,
                      background: RATING_COLORS[r.label],
                    }}
                    title={`${r.label}: ${r.value}`}
                  />
                )
              ))}
            </div>
            <div className="aw-legend">
              {ratings.map((r) => (
                r.value > 0 && (
                  <span key={r.label} className="aw-legend-item">
                    <span className="aw-legend-dot" style={{ background: RATING_COLORS[r.label] }} />
                    {r.label}: {r.value}
                  </span>
                )
              ))}
            </div>
          </div>
        )}

        {/* Price targets */}
        {hasTargets && (
          <div className="aw-targets">
            <div className="aw-target-row">
              <span className="aw-target-label">Low</span>
              <span className="aw-target-val mono">${Number(analyst.target_low || 0).toFixed(2)}</span>
            </div>
            <div className="aw-target-row aw-target-row--main">
              <span className="aw-target-label">Mean Target</span>
              <span className="aw-target-val mono" style={{ color: "var(--primary2)", fontWeight: 700 }}>
                ${Number(analyst.target_mean || 0).toFixed(2)}
              </span>
            </div>
            <div className="aw-target-row">
              <span className="aw-target-label">High</span>
              <span className="aw-target-val mono">${Number(analyst.target_high || 0).toFixed(2)}</span>
            </div>
            {analyst.target_count && (
              <span className="aw-analyst-count">{analyst.target_count} analysts</span>
            )}
          </div>
        )}
      </div>

      <style>{`
        .aw-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .aw-title { font-size: 0.85rem; font-weight: 700; color: var(--text); margin: 0; }
        .aw-consensus-badge {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 20px;
          background: rgba(59,130,246,0.12);
          color: var(--primary2);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .aw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .aw-ratings { display: flex; flex-direction: column; gap: 10px; }
        .aw-bar-stack {
          display: flex;
          height: 18px;
          border-radius: 6px;
          overflow: hidden;
          gap: 1px;
        }
        .aw-bar-segment { transition: width 0.4s ease; }
        .aw-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; }
        .aw-legend-item { display: flex; align-items: center; gap: 5px; font-size: 0.7rem; color: var(--text2); }
        .aw-legend-dot { width: 7px; height: 7px; border-radius: 50%; }
        .aw-targets { display: flex; flex-direction: column; gap: 8px; }
        .aw-target-row { display: flex; justify-content: space-between; align-items: center; }
        .aw-target-row--main {
          background: var(--surface2);
          border-radius: 8px;
          padding: 8px 12px;
        }
        .aw-target-label { font-size: 0.72rem; color: var(--text3); font-weight: 600; }
        .aw-target-val { font-size: 0.85rem; font-weight: 600; color: var(--text); }
        .aw-analyst-count { font-size: 0.68rem; color: var(--text3); text-align: right; }
        @media (max-width: 640px) { .aw-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

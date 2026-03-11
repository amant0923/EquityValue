const VERDICT_COLORS = {
  "Undervalued":   "#10b981",
  "Overvalued":    "#ef4444",
  "Fairly Valued": "#f59e0b",
};

export default function EVModelWidget({ valuation }) {
  if (!valuation?.analyst || !valuation?.consensus) return null;

  const a = valuation.analyst;
  const c = valuation.consensus;
  const hasTargets = a.target_mean || a.target_high;
  if (!hasTargets && !c.overall_verdict) return null;

  const verdictColor = VERDICT_COLORS[c.overall_verdict] || "#f59e0b";

  // Upside from model consensus
  const upside = c.upside_pct;
  const upsideColor = upside > 0 ? "#10b981" : upside < 0 ? "#ef4444" : "var(--text2)";

  // Build a simple bar showing model spread
  const models = (valuation.valuations || []).filter(v => v?.applicable);
  const verdictCounts = { Undervalued: 0, "Fairly Valued": 0, Overvalued: 0 };
  models.forEach(m => {
    if (m.verdict in verdictCounts) verdictCounts[m.verdict]++;
  });
  const total = models.length;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div className="ev-header">
        <h3 className="ev-title">EV Model Targets</h3>
        {c.overall_verdict && (
          <span className="ev-verdict-badge" style={{
            color: verdictColor,
            borderColor: verdictColor + "44",
            background: verdictColor + "11",
          }}>
            {c.overall_verdict}
          </span>
        )}
      </div>

      <div className="ev-grid">
        {/* Model verdict distribution */}
        {total > 0 && (
          <div className="ev-ratings">
            <div className="ev-bar-stack">
              {verdictCounts.Undervalued > 0 && (
                <div className="ev-bar-segment" style={{
                  width: `${(verdictCounts.Undervalued / total) * 100}%`,
                  background: "#10b981",
                }} title={`Undervalued: ${verdictCounts.Undervalued}`} />
              )}
              {verdictCounts["Fairly Valued"] > 0 && (
                <div className="ev-bar-segment" style={{
                  width: `${(verdictCounts["Fairly Valued"] / total) * 100}%`,
                  background: "#f59e0b",
                }} title={`Fairly Valued: ${verdictCounts["Fairly Valued"]}`} />
              )}
              {verdictCounts.Overvalued > 0 && (
                <div className="ev-bar-segment" style={{
                  width: `${(verdictCounts.Overvalued / total) * 100}%`,
                  background: "#ef4444",
                }} title={`Overvalued: ${verdictCounts.Overvalued}`} />
              )}
            </div>
            <div className="ev-legend">
              {verdictCounts.Undervalued > 0 && (
                <span className="ev-legend-item">
                  <span className="ev-legend-dot" style={{ background: "#10b981" }} />
                  Under: {verdictCounts.Undervalued}
                </span>
              )}
              {verdictCounts["Fairly Valued"] > 0 && (
                <span className="ev-legend-item">
                  <span className="ev-legend-dot" style={{ background: "#f59e0b" }} />
                  Fair: {verdictCounts["Fairly Valued"]}
                </span>
              )}
              {verdictCounts.Overvalued > 0 && (
                <span className="ev-legend-item">
                  <span className="ev-legend-dot" style={{ background: "#ef4444" }} />
                  Over: {verdictCounts.Overvalued}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Price targets */}
        {hasTargets && (
          <div className="ev-targets">
            <div className="ev-target-row">
              <span className="ev-target-label">Bear Case</span>
              <span className="ev-target-val mono">${Number(a.target_low || 0).toFixed(2)}</span>
            </div>
            <div className="ev-target-row ev-target-row--main">
              <span className="ev-target-label">Model Consensus</span>
              <span className="ev-target-val mono" style={{ color: verdictColor, fontWeight: 700 }}>
                ${Number(c.average_intrinsic_value || 0).toFixed(2)}
              </span>
            </div>
            <div className="ev-target-row">
              <span className="ev-target-label">Bull Case</span>
              <span className="ev-target-val mono">${Number(a.target_high || 0).toFixed(2)}</span>
            </div>
            <div className="ev-meta-row">
              <span className="ev-model-count">{c.models_used} valuation models</span>
              {upside != null && (
                <span className="ev-upside mono" style={{ color: upsideColor }}>
                  {upside > 0 ? "+" : ""}{upside}% vs current
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .ev-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .ev-title { font-size: 0.85rem; font-weight: 700; color: var(--text); margin: 0; }
        .ev-verdict-badge {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .ev-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .ev-ratings { display: flex; flex-direction: column; gap: 10px; }
        .ev-bar-stack {
          display: flex;
          height: 18px;
          border-radius: 6px;
          overflow: hidden;
          gap: 1px;
        }
        .ev-bar-segment { transition: width 0.4s ease; }
        .ev-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; }
        .ev-legend-item { display: flex; align-items: center; gap: 5px; font-size: 0.7rem; color: var(--text2); }
        .ev-legend-dot { width: 7px; height: 7px; border-radius: 50%; }
        .ev-targets { display: flex; flex-direction: column; gap: 8px; }
        .ev-target-row { display: flex; justify-content: space-between; align-items: center; }
        .ev-target-row--main {
          background: var(--surface2);
          border-radius: 8px;
          padding: 8px 12px;
        }
        .ev-target-label { font-size: 0.72rem; color: var(--text3); font-weight: 600; }
        .ev-target-val { font-size: 0.85rem; font-weight: 600; color: var(--text); }
        .ev-meta-row { display: flex; justify-content: space-between; align-items: center; }
        .ev-model-count { font-size: 0.68rem; color: var(--text3); }
        .ev-upside { font-size: 0.72rem; font-weight: 700; }
        @media (max-width: 640px) { .ev-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

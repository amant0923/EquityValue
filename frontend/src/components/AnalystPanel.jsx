const REC_CONFIG = {
  "strong_buy":  { label: "Strong Buy",  color: "#10b981", score: 1 },
  "buy":         { label: "Buy",         color: "#34d399", score: 2 },
  "hold":        { label: "Hold",        color: "#f59e0b", score: 3 },
  "underperform":{ label: "Underperform",color: "#f97316", score: 4 },
  "sell":        { label: "Sell",        color: "#ef4444", score: 5 },
};

const fmtPrice = v => v != null ? `$${Number(v).toFixed(2)}` : "—";
const fmtPct   = (v, base) => {
  if (v == null || base == null) return "—";
  const pct = ((v - base) / base) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
};

export default function AnalystPanel({ data }) {
  if (!data) return null;
  const { target_mean, target_high, target_low, target_median,
          recommendation, recommendation_mean, analyst_count, current_price } = data;

  if (!target_mean && !recommendation) return null;

  const rec     = REC_CONFIG[recommendation] || REC_CONFIG["hold"];
  const upside  = target_mean && current_price ? ((target_mean - current_price) / current_price * 100) : null;
  const upsideColor = upside == null ? "var(--text2)" : upside > 0 ? "var(--green2)" : "var(--red2)";

  // Build price range bar
  const rangeMin  = target_low  || target_mean * 0.85;
  const rangeMax  = target_high || target_mean * 1.15;
  const rangePct  = target_mean && rangeMax > rangeMin
    ? ((target_mean - rangeMin) / (rangeMax - rangeMin)) * 100
    : 50;
  const currentPct = current_price && rangeMax > rangeMin
    ? Math.min(Math.max(((current_price - rangeMin) / (rangeMax - rangeMin)) * 100, 0), 100)
    : null;

  // Recommendation score bar (1=strong buy, 5=sell)
  const scoreBarWidth = recommendation_mean
    ? ((5 - recommendation_mean) / 4) * 100
    : null;
  const scoreColor = recommendation_mean
    ? recommendation_mean <= 2 ? "#10b981"
    : recommendation_mean <= 3 ? "#f59e0b"
    : "#ef4444"
    : rec.color;

  return (
    <div className="ap-wrap">
      <div className="ap-header">
        <span className="ap-title">ValuEngine Price Targets</span>
        <span className="ap-count">Model-derived estimates</span>
      </div>

      <div className="ap-body">
        {/* Left — recommendation verdict */}
        <div className="ap-verdict-col">
          <div className="ap-verdict-badge" style={{ color: rec.color, borderColor: rec.color + "44", background: rec.color + "11" }}>
            {rec.label}
          </div>
          {recommendation_mean && (
            <div className="ap-score-wrap">
              <div className="ap-score-bar-bg">
                <div className="ap-score-bar-fill" style={{ width: `${scoreBarWidth}%`, background: scoreColor }} />
              </div>
              <div className="ap-score-labels">
                <span>Strong Buy</span>
                <span>Hold</span>
                <span>Sell</span>
              </div>
            </div>
          )}
        </div>

        {/* Right — price targets */}
        <div className="ap-targets-col">
          <div className="ap-target-grid">
            <div className="ap-target-item">
              <span className="ap-target-label">Consensus Target</span>
              <span className="ap-target-value">{fmtPrice(target_mean)}</span>
              {upside != null && (
                <span className="ap-target-upside" style={{ color: upsideColor }}>
                  {upside >= 0 ? "+" : ""}{upside.toFixed(1)}% upside
                </span>
              )}
            </div>
            <div className="ap-target-item">
              <span className="ap-target-label">Median Model</span>
              <span className="ap-target-value">{fmtPrice(target_median)}</span>
              <span className="ap-target-upside" style={{ color: "var(--text3)" }}>
                {fmtPct(target_median, current_price)}
              </span>
            </div>
            <div className="ap-target-item">
              <span className="ap-target-label">Bull Case</span>
              <span className="ap-target-value" style={{ color: "var(--green2)" }}>{fmtPrice(target_high)}</span>
              <span className="ap-target-upside" style={{ color: "var(--green2)" }}>
                {fmtPct(target_high, current_price)}
              </span>
            </div>
            <div className="ap-target-item">
              <span className="ap-target-label">Bear Case</span>
              <span className="ap-target-value" style={{ color: "var(--red2)" }}>{fmtPrice(target_low)}</span>
              <span className="ap-target-upside" style={{ color: "var(--red2)" }}>
                {fmtPct(target_low, current_price)}
              </span>
            </div>
          </div>

          {/* Price range bar */}
          {target_low && target_high && (
            <div className="ap-range-wrap">
              <div className="ap-range-labels">
                <span>{fmtPrice(target_low)}</span>
                <span className="ap-range-title">Model-Derived Valuation Range</span>
                <span>{fmtPrice(target_high)}</span>
              </div>
              <div className="ap-range-track">
                {/* Current price marker */}
                {currentPct != null && (
                  <div className="ap-range-current" style={{ left: `${currentPct}%` }} title={`Current: ${fmtPrice(current_price)}`} />
                )}
                {/* Mean target marker */}
                <div className="ap-range-mean" style={{ left: `${rangePct}%` }} title={`Mean: ${fmtPrice(target_mean)}`} />
              </div>
              <div className="ap-range-legend">
                <span><span className="ap-legend-dot ap-legend-dot--current" />Current Price</span>
                <span><span className="ap-legend-dot ap-legend-dot--mean" />Consensus Target</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparison vs ValuEngine consensus — rendered by parent via props if passed */}

      <style>{`
        .ap-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 22px 24px; display: flex; flex-direction: column; gap: 20px; }
        .ap-header { display: flex; align-items: center; justify-content: space-between; }
        .ap-title { font-size: 0.72rem; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.8px; }
        .ap-count { font-size: 0.7rem; background: var(--surface2); border: 1px solid var(--border); color: var(--text3); padding: 2px 10px; border-radius: 20px; }
        .ap-body { display: flex; gap: 32px; flex-wrap: wrap; }
        .ap-verdict-col { display: flex; flex-direction: column; gap: 16px; min-width: 160px; justify-content: center; }
        .ap-verdict-badge { font-size: 1.1rem; font-weight: 700; padding: 10px 20px; border-radius: var(--radius); border: 1px solid; text-align: center; letter-spacing: 0.5px; }
        .ap-score-wrap { display: flex; flex-direction: column; gap: 4px; }
        .ap-score-bar-bg { height: 6px; background: var(--surface3); border-radius: 3px; overflow: hidden; }
        .ap-score-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
        .ap-score-labels { display: flex; justify-content: space-between; font-size: 0.6rem; color: var(--text3); }
        .ap-targets-col { flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: 16px; }
        .ap-target-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ap-target-item { display: flex; flex-direction: column; gap: 2px; }
        .ap-target-label { font-size: 0.65rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; }
        .ap-target-value { font-size: 1.05rem; font-weight: 700; color: var(--text); }
        .ap-target-upside { font-size: 0.72rem; font-weight: 600; }
        .ap-range-wrap { display: flex; flex-direction: column; gap: 6px; }
        .ap-range-labels { display: flex; justify-content: space-between; align-items: center; font-size: 0.68rem; color: var(--text3); }
        .ap-range-title { font-size: 0.65rem; color: var(--text3); letter-spacing: 0.3px; }
        .ap-range-track { position: relative; height: 8px; background: linear-gradient(to right, rgba(239,68,68,0.2), rgba(245,158,11,0.2), rgba(16,185,129,0.2)); border-radius: 4px; margin: 2px 0; }
        .ap-range-current { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background: var(--primary2); border-radius: 50%; border: 2px solid var(--bg); z-index: 2; }
        .ap-range-mean { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background: white; border-radius: 50%; border: 2px solid var(--bg); z-index: 1; }
        .ap-range-legend { display: flex; gap: 16px; font-size: 0.65rem; color: var(--text3); }
        .ap-legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
        .ap-legend-dot--current { background: var(--primary2); }
        .ap-legend-dot--mean { background: white; border: 1px solid var(--text3); }
      `}</style>
    </div>
  );
}

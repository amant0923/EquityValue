export default function PriceTargetChart({ data, currentPrice }) {
  if (!data || !data.target_mean) return null;

  const low = data.target_low || 0;
  const high = data.target_high || 0;
  const mean = data.target_mean || 0;
  const median = data.target_median || mean;
  const price = currentPrice || 0;

  // Range for the gauge
  const rangeMin = Math.min(low, price) * 0.95;
  const rangeMax = Math.max(high, price) * 1.05;
  const span = rangeMax - rangeMin;

  const pct = (val) => ((val - rangeMin) / span) * 100;

  const upside = price > 0 ? (((mean - price) / price) * 100).toFixed(1) : null;
  const upsideColor = upside > 0 ? "var(--green2)" : upside < 0 ? "var(--red2)" : "var(--text2)";

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 className="ci-section-title">Price Targets</h3>
        {data.target_count && (
          <span style={{ fontSize: "0.68rem", color: "var(--text3)" }}>
            {data.target_count} analyst{data.target_count !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Gauge */}
      <div className="ptc-gauge-wrap">
        {/* Track */}
        <div className="ptc-track">
          {/* Range fill from low to high */}
          <div
            className="ptc-range"
            style={{
              left: `${pct(low)}%`,
              width: `${pct(high) - pct(low)}%`,
            }}
          />
          {/* Low marker */}
          <div className="ptc-marker" style={{ left: `${pct(low)}%` }} />
          {/* High marker */}
          <div className="ptc-marker" style={{ left: `${pct(high)}%` }} />
          {/* Mean marker */}
          <div className="ptc-marker ptc-marker--mean" style={{ left: `${pct(mean)}%` }} />
          {/* Median marker */}
          {median !== mean && (
            <div className="ptc-marker ptc-marker--median" style={{ left: `${pct(median)}%` }} />
          )}
          {/* Current price marker */}
          {price > 0 && (
            <div className="ptc-marker ptc-marker--price" style={{ left: `${pct(price)}%` }}>
              <div className="ptc-price-arrow" />
            </div>
          )}
        </div>

        {/* Labels — stagger vertically if mean/high are too close */}
        <div className="ptc-labels">
          <div className="ptc-label" style={{ left: `${pct(low)}%` }}>
            <span className="ptc-label-val">${low.toFixed(2)}</span>
            <span className="ptc-label-name">Low</span>
          </div>
          <div className="ptc-label" style={{ left: `${pct(mean)}%` }}>
            <span className="ptc-label-val" style={{ color: "var(--primary2)", fontWeight: 700 }}>
              ${mean.toFixed(2)}
            </span>
            <span className="ptc-label-name">Mean</span>
          </div>
          <div className="ptc-label" style={{ left: `${pct(high)}%`, top: Math.abs(pct(high) - pct(mean)) < 18 ? 28 : 0 }}>
            <span className="ptc-label-val">${high.toFixed(2)}</span>
            <span className="ptc-label-name">High</span>
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="ptc-summary">
        {price > 0 && (
          <div className="ptc-summary-item">
            <span className="ptc-summary-label">Current Price</span>
            <span className="ptc-summary-val mono">${price.toFixed(2)}</span>
          </div>
        )}
        <div className="ptc-summary-item">
          <span className="ptc-summary-label">Median Target</span>
          <span className="ptc-summary-val mono">${median.toFixed(2)}</span>
        </div>
        {upside !== null && (
          <div className="ptc-summary-item">
            <span className="ptc-summary-label">Upside</span>
            <span className="ptc-summary-val mono" style={{ color: upsideColor }}>
              {upside > 0 ? "+" : ""}{upside}%
            </span>
          </div>
        )}
      </div>

      <style>{`
        .ci-section-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 12px;
        }
        .ptc-gauge-wrap {
          position: relative;
          margin: 24px 20px 48px;
        }
        .ptc-track {
          position: relative;
          height: 8px;
          background: var(--surface2);
          border-radius: 4px;
        }
        .ptc-range {
          position: absolute;
          top: 0;
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--primary2));
          border-radius: 4px;
          opacity: 0.35;
        }
        .ptc-marker {
          position: absolute;
          top: -4px;
          width: 2px;
          height: 16px;
          background: var(--text3);
          border-radius: 1px;
          transform: translateX(-1px);
        }
        .ptc-marker--mean {
          width: 4px;
          height: 20px;
          top: -6px;
          background: var(--primary2);
          border-radius: 2px;
          transform: translateX(-2px);
        }
        .ptc-marker--median {
          width: 2px;
          height: 16px;
          top: -4px;
          background: var(--yellow2);
          border-radius: 1px;
          transform: translateX(-1px);
        }
        .ptc-marker--price {
          width: 0;
          height: 0;
          top: auto;
          bottom: -8px;
          background: none;
        }
        .ptc-price-arrow {
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 8px solid var(--green2);
          transform: translateX(-6px);
        }
        .ptc-labels {
          position: relative;
          height: 64px;
          margin-top: 8px;
        }
        .ptc-label {
          position: absolute;
          transform: translateX(-50%);
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .ptc-label-val {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text);
          font-family: var(--font-mono, monospace);
        }
        .ptc-label-name {
          font-size: 0.62rem;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .ptc-summary {
          display: flex;
          gap: 24px;
          justify-content: center;
          padding-top: 16px;
          border-top: 1px solid var(--border);
          margin-top: 8px;
        }
        .ptc-summary-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .ptc-summary-label {
          font-size: 0.65rem;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .ptc-summary-val {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text);
        }
      `}</style>
    </div>
  );
}

import { useRef, useEffect, useState } from "react";

const CATEGORY_COLORS = {
  "Income-Based":  { bar: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)" },
  "Market-Based":  { bar: "#8b5cf6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)" },
  "Asset-Based":   { bar: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
};

const MODEL_SHORT = {
  "DCF (Discounted Cash Flow)":    "DCF",
  "Capitalization of Earnings":    "Cap. Earnings",
  "Gordon Growth Model (DDM)":     "DDM",
  "Residual Income":               "Residual Income",
  "EV/EBITDA Comparables":         "EV/EBITDA",
  "EV/EBIT Comparables":           "EV/EBIT",
  "EV/Sales Comparables":          "EV/Sales",
  "P/E Comparables":               "P/E",
  "P/S Comparables":               "P/S",
  "PEG Ratio":                     "PEG",
  "Price-to-Book (P/B)":           "P/B",
  "Graham Number":                 "Graham #",
};

export default function FootballField({ valuations, currentPrice, consensus }) {
  const applicable = (valuations || []).filter(v => v?.applicable);
  if (!applicable.length || !currentPrice) return null;

  const values = applicable.map(v => v.intrinsic_value);
  const allValues = [...values, currentPrice];
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const padding = (dataMax - dataMin) * 0.15 || currentPrice * 0.1;
  const domainMin = Math.max(0, dataMin - padding);
  const domainMax = dataMax + padding;
  const range = domainMax - domainMin;

  const toPct = val => ((val - domainMin) / range) * 100;
  const currentPct = toPct(currentPrice);
  const consensusPct = consensus ? toPct(consensus.average_intrinsic_value) : null;

  // Generate axis ticks
  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    domainMin + (range / (tickCount - 1)) * i
  );

  // Group by category
  const byCategory = {};
  applicable.forEach(v => {
    const cat = v.category || "Market-Based";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(v);
  });

  const rows = [];
  Object.entries(byCategory).forEach(([cat, models]) => {
    rows.push({ type: "header", cat });
    models.forEach(m => rows.push({ type: "model", m, cat }));
  });

  const verdictColor = v =>
    v === "Undervalued" ? "#10b981" : v === "Overvalued" ? "#ef4444" : "#f59e0b";

  return (
    <div className="ff-wrap">
      <div className="ff-header">
        <div>
          <span className="ff-title">Football Field Valuation Chart</span>
          <span className="ff-sub">Intrinsic value range across all applicable models — institutional standard format</span>
        </div>
        {consensus && (
          <div className="ff-consensus-pill" style={{
            color: verdictColor(consensus.overall_verdict),
            borderColor: verdictColor(consensus.overall_verdict) + "44",
            background: verdictColor(consensus.overall_verdict) + "11",
          }}>
            Consensus: ${consensus.average_intrinsic_value} &nbsp;·&nbsp;
            {consensus.upside_pct > 0 ? "+" : ""}{consensus.upside_pct}%
          </div>
        )}
      </div>

      <div className="ff-chart">
        {/* Y-axis labels */}
        <div className="ff-y-axis">
          {rows.map((row, i) => (
            <div key={i} className={`ff-y-label ${row.type === "header" ? "ff-y-cat" : ""}`}>
              {row.type === "header"
                ? row.cat
                : MODEL_SHORT[row.m.model] || row.m.model}
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div className="ff-plot-area">
          {/* Tick lines */}
          {ticks.map((t, i) => (
            <div key={i} className="ff-tick-line" style={{ left: `${toPct(t)}%` }} />
          ))}

          {/* Current price line */}
          <div className="ff-price-line" style={{ left: `${currentPct}%` }}>
            <div className="ff-price-label">${currentPrice.toFixed(0)}<br/>Current</div>
          </div>

          {/* Consensus line */}
          {consensusPct != null && (
            <div className="ff-consensus-line" style={{ left: `${consensusPct}%` }}>
              <div className="ff-consensus-label">${consensus.average_intrinsic_value}<br/>Consensus</div>
            </div>
          )}

          {/* Bars */}
          {rows.map((row, i) => {
            if (row.type === "header") {
              return <div key={i} className="ff-row ff-row--header" />;
            }
            const { m, cat } = row;
            const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS["Market-Based"];
            const barPct = toPct(m.intrinsic_value);
            const cpPct  = currentPct;
            const left   = Math.min(barPct, cpPct);
            const width  = Math.abs(barPct - cpPct);
            const verdict = m.verdict;

            return (
              <div key={i} className="ff-row">
                {/* Dot at intrinsic value */}
                <div className="ff-bar-range"
                  style={{ left: `${left}%`, width: `${width}%`, background: colors.bg, border: `1px solid ${colors.border}` }}
                />
                <div className="ff-dot" style={{ left: `${barPct}%`, background: colors.bar }} title={`$${m.intrinsic_value}`}>
                  <div className="ff-dot-tooltip">
                    <strong>${m.intrinsic_value}</strong>
                    <span style={{ color: verdictColor(verdict) }}>{verdict}</span>
                    <span>{m.upside_pct > 0 ? "+" : ""}{m.upside_pct}%</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* X-axis ticks */}
          <div className="ff-x-axis">
            {ticks.map((t, i) => (
              <div key={i} className="ff-x-tick" style={{ left: `${toPct(t)}%` }}>
                ${Math.round(t)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="ff-legend">
        {Object.entries(CATEGORY_COLORS).map(([cat, c]) => (
          <div key={cat} className="ff-legend-item">
            <div className="ff-legend-dot" style={{ background: c.bar }} />
            <span>{cat}</span>
          </div>
        ))}
        <div className="ff-legend-item">
          <div className="ff-legend-line ff-legend-line--price" />
          <span>Current Price</span>
        </div>
        {consensus && (
          <div className="ff-legend-item">
            <div className="ff-legend-line ff-legend-line--consensus" />
            <span>Consensus</span>
          </div>
        )}
      </div>

      <style>{`
        .ff-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .ff-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .ff-title {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text2);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 4px;
        }
        .ff-sub {
          font-size: 0.7rem;
          color: var(--text3);
        }
        .ff-consensus-pill {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 5px 14px;
          border-radius: var(--radius);
          border: 1px solid;
          white-space: nowrap;
          letter-spacing: 0.3px;
        }
        .ff-chart {
          display: flex;
          gap: 0;
          position: relative;
        }
        .ff-y-axis {
          display: flex;
          flex-direction: column;
          min-width: 120px;
          flex-shrink: 0;
          padding-bottom: 24px;
        }
        .ff-y-label {
          height: 36px;
          display: flex;
          align-items: center;
          font-size: 0.7rem;
          color: var(--text3);
          padding-right: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ff-y-cat {
          height: 28px;
          font-size: 0.62rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--text3);
          align-items: flex-end;
          padding-bottom: 4px;
        }
        .ff-plot-area {
          flex: 1;
          position: relative;
          border-left: 1px solid var(--border2);
        }
        .ff-tick-line {
          position: absolute;
          top: 0;
          bottom: 24px;
          width: 1px;
          background: var(--border);
          z-index: 0;
          transform: translateX(-50%);
        }
        .ff-price-line {
          position: absolute;
          top: 0;
          bottom: 24px;
          width: 2px;
          background: #3b82f6;
          z-index: 5;
          transform: translateX(-50%);
        }
        .ff-price-label {
          position: absolute;
          top: -36px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.6rem;
          font-weight: 700;
          color: #3b82f6;
          text-align: center;
          white-space: nowrap;
          line-height: 1.3;
        }
        .ff-consensus-line {
          position: absolute;
          top: 0;
          bottom: 24px;
          width: 2px;
          background: white;
          z-index: 4;
          transform: translateX(-50%);
          border-left: 2px dashed white;
        }
        .ff-consensus-label {
          position: absolute;
          top: -36px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.6rem;
          font-weight: 700;
          color: white;
          text-align: center;
          white-space: nowrap;
          line-height: 1.3;
        }
        .ff-row {
          height: 36px;
          position: relative;
          display: flex;
          align-items: center;
        }
        .ff-row--header {
          height: 28px;
        }
        .ff-bar-range {
          position: absolute;
          height: 14px;
          border-radius: 2px;
          z-index: 1;
        }
        .ff-dot {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          transform: translateX(-50%);
          z-index: 3;
          border: 2px solid var(--bg);
          cursor: pointer;
        }
        .ff-dot-tooltip {
          display: none;
          position: absolute;
          bottom: 18px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--surface3);
          border: 1px solid var(--border2);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 0.68rem;
          white-space: nowrap;
          z-index: 20;
          flex-direction: column;
          gap: 2px;
          text-align: center;
        }
        .ff-dot:hover .ff-dot-tooltip { display: flex; }
        .ff-x-axis {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 24px;
        }
        .ff-x-tick {
          position: absolute;
          transform: translateX(-50%);
          font-size: 0.62rem;
          color: var(--text3);
          white-space: nowrap;
        }
        .ff-legend {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          padding-top: 4px;
          border-top: 1px solid var(--border);
        }
        .ff-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.68rem;
          color: var(--text3);
        }
        .ff-legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .ff-legend-line {
          width: 16px;
          height: 2px;
        }
        .ff-legend-line--price { background: #3b82f6; }
        .ff-legend-line--consensus { background: white; }
      `}</style>
    </div>
  );
}

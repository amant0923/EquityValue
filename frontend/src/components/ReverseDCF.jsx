export default function ReverseDCF({ data }) {
  if (!data) return null;

  const growth = data.implied_growth_rate ?? 0;
  const isAggressive = growth > 25;
  const barColor = growth > 40 ? "#ef4444" : growth > 25 ? "#f59e0b" : growth > 10 ? "#10b981" : "var(--primary2)";
  const barWidth = Math.min(Math.max(growth, 0), 60) / 60 * 100;

  const fmtLarge = (v) => {
    const a = Math.abs(v);
    if (a >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
    if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (a >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    return `$${v}`;
  };

  return (
    <div className="rdcf-wrap">
      <div className="rdcf-header">
        <div>
          <span className="rdcf-title">Reverse DCF</span>
          <span className="rdcf-sub">What growth rate is the market pricing in?</span>
        </div>
        <span className="rdcf-growth-pill" style={{
          color: barColor,
          borderColor: barColor + "44",
          background: barColor + "11",
        }}>
          {growth > 0 ? "+" : ""}{growth}% / year
        </span>
      </div>

      <div className="rdcf-body">
        {/* Growth bar */}
        <div className="rdcf-bar-section">
          <div className="rdcf-bar-label">Implied Annual FCF Growth</div>
          <div className="rdcf-bar-track">
            <div className="rdcf-bar-fill" style={{ width: `${barWidth}%`, background: barColor }} />
            <div className="rdcf-bar-markers">
              <span style={{ left: "8.3%" }}>5%</span>
              <span style={{ left: "25%" }}>15%</span>
              <span style={{ left: "41.7%" }}>25%</span>
              <span style={{ left: "66.7%" }}>40%</span>
            </div>
          </div>
        </div>

        {/* Key numbers */}
        <div className="rdcf-stats">
          <div className="rdcf-stat">
            <span className="rdcf-stat-label">Current FCF</span>
            <span className="rdcf-stat-val mono">{fmtLarge(data.current_fcf)}</span>
          </div>
          <div className="rdcf-stat">
            <span className="rdcf-stat-label">Implied Year 10 FCF</span>
            <span className="rdcf-stat-val mono">{fmtLarge(data.year10_fcf)}</span>
          </div>
          <div className="rdcf-stat">
            <span className="rdcf-stat-label">WACC Used</span>
            <span className="rdcf-stat-val mono">{data.wacc_used}%</span>
          </div>
          <div className="rdcf-stat">
            <span className="rdcf-stat-label">Terminal Growth</span>
            <span className="rdcf-stat-val mono">{data.terminal_growth}%</span>
          </div>
        </div>

        {/* Assessment */}
        {data.assessment && (
          <div className="rdcf-assessment" style={{ borderColor: barColor + "33" }}>
            <span className="rdcf-assess-label">Market Expectation</span>
            <span className="rdcf-assess-text">{data.assessment}</span>
          </div>
        )}

        {/* Notes */}
        {(data.margin_note || data.fcf_note) && (
          <div className="rdcf-notes">
            {data.margin_note && <span className="rdcf-note">{data.margin_note}</span>}
            {data.fcf_note && <span className="rdcf-note">{data.fcf_note}</span>}
          </div>
        )}
      </div>

      <style>{`
        .rdcf-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .rdcf-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .rdcf-title {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text2);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 4px;
        }
        .rdcf-sub { font-size: 0.7rem; color: var(--text3); }
        .rdcf-growth-pill {
          font-size: 0.85rem;
          font-weight: 800;
          padding: 6px 16px;
          border-radius: var(--radius);
          border: 1px solid;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }
        .rdcf-body { display: flex; flex-direction: column; gap: 16px; }

        .rdcf-bar-section { display: flex; flex-direction: column; gap: 6px; }
        .rdcf-bar-label { font-size: 0.68rem; color: var(--text3); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .rdcf-bar-track {
          position: relative;
          height: 12px;
          background: var(--surface2);
          border-radius: 6px;
          overflow: visible;
        }
        .rdcf-bar-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 0.6s ease;
        }
        .rdcf-bar-markers {
          position: relative;
          height: 18px;
          margin-top: 4px;
        }
        .rdcf-bar-markers span {
          position: absolute;
          transform: translateX(-50%);
          font-size: 0.58rem;
          color: var(--text3);
        }

        .rdcf-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .rdcf-stat { display: flex; flex-direction: column; gap: 2px; }
        .rdcf-stat-label { font-size: 0.62rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; }
        .rdcf-stat-val { font-size: 0.88rem; font-weight: 700; color: var(--text); }

        .rdcf-assessment {
          background: var(--surface2);
          border-left: 3px solid;
          border-radius: 0 var(--radius) var(--radius) 0;
          padding: 12px 16px;
        }
        .rdcf-assess-label {
          display: block;
          font-size: 0.62rem;
          font-weight: 700;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .rdcf-assess-text { font-size: 0.8rem; color: var(--text2); line-height: 1.5; }

        .rdcf-notes { display: flex; flex-direction: column; gap: 4px; }
        .rdcf-note { font-size: 0.7rem; color: var(--yellow2); font-style: italic; }

        @media (max-width: 640px) {
          .rdcf-stats { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}


const COLORS = { "Undervalued": "var(--green2)", "Overvalued": "var(--red2)", "Fairly Valued": "var(--yellow2)" };

export default function ConsensusCard({ data }) {
  const color = COLORS[data.overall_verdict] || "var(--text2)";
  const sign  = data.upside_pct > 0 ? "+" : "";
  return (
    <div className="cc-wrap" style={{ borderColor: color + "33" }}>
      <div className="cc-left">
        <p className="cc-eyebrow">Consensus Valuation — {data.models_used} models</p>
        <p className="cc-verdict" style={{ color }}>{data.overall_verdict}</p>
        <p className="cc-sub">Arithmetic mean of all applicable model intrinsic values</p>
      </div>
      <div className="cc-right">
        <p className="cc-value">${data.average_intrinsic_value}</p>
        <p className="cc-upside" style={{ color }}>{sign}{data.upside_pct}%</p>
        <p className="cc-current">vs current ${data.current_price}</p>
      </div>
      <style>{`
        .cc-wrap { background: var(--surface); border: 1px solid; border-radius: var(--radius-lg); padding: 22px 28px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
        .cc-eyebrow { font-size: 0.68rem; color: var(--text3); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 6px; }
        .cc-verdict { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
        .cc-sub { font-size: 0.75rem; color: var(--text2); }
        .cc-right { text-align: right; }
        .cc-value { font-size: 2rem; font-weight: 700; letter-spacing: -1px; color: var(--text); }
        .cc-upside { font-size: 1.1rem; font-weight: 600; }
        .cc-current { font-size: 0.75rem; color: var(--text2); }
      `}</style>
    </div>
  );
}

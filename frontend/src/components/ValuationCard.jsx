
const COLORS = { "Undervalued": "var(--green2)", "Overvalued": "var(--red2)", "Fairly Valued": "var(--yellow2)" };
const CAT_COLORS = { "Income-Based": "blue", "Market-Based": "purple", "Asset-Based": "green" };

export default function ValuationCard({ data }) {
  if (!data.applicable) return null;
  const color = COLORS[data.verdict] || "var(--text2)";
  const sign  = data.upside_pct > 0 ? "+" : "";
  const cat   = CAT_COLORS[data.category] || "blue";

  return (
    <div className="vc-wrap">
      <div className="vc-top">
        <div>
          <span className={`vc-cat method-badge method-badge--${cat} method-badge--sm`}>{data.category || ""}</span>
          <p className="vc-model">{data.model}</p>
        </div>
        <span className="vc-verdict" style={{ color, background: color.replace(")", ",0.1)").replace("var(", "rgba(").replace("--green2","16,185,129").replace("--red2","220,38,38").replace("--yellow2","217,119,6") }}>
          {data.verdict}
        </span>
      </div>
      <div className="vc-values">
        <div>
          <p className="vc-label">Intrinsic Value</p>
          <p className="vc-num">${data.intrinsic_value}</p>
        </div>
        <div>
          <p className="vc-label">Upside / Downside</p>
          <p className="vc-num" style={{ color }}>{sign}{data.upside_pct}%</p>
        </div>
      </div>
      <p className="vc-desc">{data.description}</p>
      <div className="vc-assumptions">
        {Object.entries(data.assumptions || {}).map(([k, v]) => (
          <div key={k} className="vc-row">
            <span className="vc-key">{k}</span>
            <span className="vc-val">{String(v)}</span>
          </div>
        ))}
      </div>
      <style>{`
        .vc-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.15s; }
        .vc-wrap:hover { border-color: var(--border2); }
        .vc-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .vc-cat { margin-bottom: 5px; display: inline-block; }
        .vc-model { font-size: 0.85rem; font-weight: 700; color: var(--text); letter-spacing: -0.2px; }
        .vc-verdict { font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 3px; white-space: nowrap; letter-spacing: 0.3px; text-transform: uppercase; }
        .vc-values { display: flex; gap: 24px; }
        .vc-label { font-size: 0.65rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .vc-num { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.5px; color: var(--text); }
        .vc-desc { font-size: 0.75rem; color: var(--text2); line-height: 1.6; border-top: 1px solid var(--border); padding-top: 10px; }
        .vc-assumptions { display: flex; flex-direction: column; gap: 5px; }
        .vc-row { display: flex; justify-content: space-between; font-size: 0.73rem; }
        .vc-key { color: var(--text3); }
        .vc-val { color: var(--text); font-weight: 500; }
      `}</style>
    </div>
  );
}

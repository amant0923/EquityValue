
const fmt = n => n >= 1e12 ? `$${(n/1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${n}`;
const fmtPct = v => v != null ? `${(v * 100).toFixed(1)}%` : "—";
const fmtNum = v => v != null ? v.toFixed(2) : "—";

const CONFIDENCE_COLOR = { High: "var(--green2)", Medium: "var(--yellow2)", Low: "var(--red2)" };

export default function CompanyHeader({ data }) {
  const km = data.key_metrics || {};
  const metrics = [
    { label: "P/E",          value: fmtNum(km.pe_ratio) },
    { label: "EV/EBITDA",    value: fmtNum(km.ev_ebitda) },
    { label: "P/B",          value: fmtNum(km.pb_ratio) },
    { label: "P/S",          value: fmtNum(km.ps_ratio) },
    { label: "Beta",         value: fmtNum(km.beta) },
    { label: "ROE",          value: fmtPct(km.roe) },
    { label: "Net Margin",   value: fmtPct(km.profit_margin) },
    { label: "Rev. Growth",  value: fmtPct(km.revenue_growth) },
    { label: "Div. Yield",   value: fmtPct(km.dividend_yield) },
    { label: "EPS",          value: km.eps != null ? `$${fmtNum(km.eps)}` : "—" },
  ];
  const confColor = CONFIDENCE_COLOR[data.confidence] || "var(--text2)";

  return (
    <div className="ch-wrap">
      <div className="ch-top">
        <div className="ch-left">
          <div className="ch-title-row">
            <h1 className="ch-name">{data.company_name}</h1>
            <span className="ch-ticker">{data.ticker}</span>
            {data.confidence && (
              <span className="ch-confidence" style={{ color: confColor, borderColor: confColor + "44", background: confColor + "11" }}>
                {data.confidence} Confidence
              </span>
            )}
          </div>
          <div className="ch-badges">
            <span className="ch-badge ch-badge--sector">{data.sector}</span>
            <span className="ch-badge ch-badge--type">{data.company_type}</span>
            {data.industry && <span className="ch-badge ch-badge--industry">{data.industry}</span>}
          </div>
          {data.description && <p className="ch-desc">{data.description.slice(0, 300)}…</p>}
        </div>
        <div className="ch-right">
          <span className="ch-price-label">Current Price</span>
          <span className="ch-price">${data.current_price?.toFixed(2)}</span>
          {data.market_cap && <span className="ch-mktcap">Mkt Cap: {fmt(data.market_cap)}</span>}
          {data.website && <a href={data.website} target="_blank" rel="noreferrer" className="ch-link">{data.website.replace(/https?:\/\//, "")}</a>}
        </div>
      </div>
      <div className="ch-metrics">
        {metrics.map((m, i) => (
          <div key={i} className="ch-metric">
            <span className="ch-metric-label">{m.label}</span>
            <span className="ch-metric-value">{m.value}</span>
          </div>
        ))}
      </div>
      <style>{`
        .ch-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        .ch-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; padding: 22px 24px 18px; }
        .ch-left { flex: 1; min-width: 240px; }
        .ch-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
        .ch-name { font-size: 1.2rem; font-weight: 700; color: var(--text); letter-spacing: -0.5px; }
        .ch-ticker { font-size: 0.78rem; font-weight: 700; color: var(--primary2); background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.2); padding: 2px 8px; border-radius: 3px; letter-spacing: 0.5px; }
        .ch-confidence { font-size: 0.68rem; font-weight: 600; padding: 2px 8px; border-radius: 3px; border: 1px solid; letter-spacing: 0.5px; text-transform: uppercase; }
        .ch-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .ch-badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 3px; font-weight: 500; letter-spacing: 0.3px; }
        .ch-badge--sector { background: rgba(37,99,235,0.08); color: var(--primary2); border: 1px solid rgba(37,99,235,0.15); }
        .ch-badge--type { background: rgba(217,119,6,0.08); color: var(--yellow2); border: 1px solid rgba(217,119,6,0.15); }
        .ch-badge--industry { background: var(--surface2); color: var(--text3); border: 1px solid var(--border); }
        .ch-desc { font-size: 0.78rem; color: var(--text2); line-height: 1.65; }
        .ch-right { text-align: right; flex-shrink: 0; }
        .ch-price-label { display: block; font-size: 0.68rem; color: var(--text3); letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px; }
        .ch-price { display: block; font-size: 2rem; font-weight: 700; letter-spacing: -1px; color: var(--text); }
        .ch-mktcap { display: block; font-size: 0.75rem; color: var(--text2); margin-top: 4px; }
        .ch-link { display: block; font-size: 0.72rem; color: var(--primary2); margin-top: 4px; text-decoration: none; }
        .ch-link:hover { text-decoration: underline; }
        .ch-metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); border-top: 1px solid var(--border); }
        .ch-metric { padding: 10px 16px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; }
        .ch-metric:last-child { border-right: none; }
        .ch-metric-label { font-size: 0.65rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; }
        .ch-metric-value { font-size: 0.88rem; font-weight: 600; color: var(--text); }
      `}</style>
    </div>
  );
}

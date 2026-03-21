import { motion } from "framer-motion";

const fmt = n => n >= 1e12 ? `$${(n/1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${n}`;
const fmtPct = v => v != null ? `${(v * 100).toFixed(1)}%` : "—";
const fmtNum = v => v != null ? v.toFixed(2) : "—";

const CONFIDENCE_CONFIG = {
  High:   { color: "var(--green2)",  bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)" },
  Medium: { color: "var(--yellow2)", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)" },
  Low:    { color: "var(--red2)",    bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)" },
};

export default function CompanyHeader({ data }) {
  const km = data.key_metrics || {};
  const conf = CONFIDENCE_CONFIG[data.confidence] || {};

  const metrics = [
    { label: "P/E",         value: fmtNum(km.pe_ratio),       good: km.pe_ratio != null && km.pe_ratio < 20 ? "good" : km.pe_ratio > 35 ? "bad" : "neutral" },
    { label: "EV/EBITDA",   value: fmtNum(km.ev_ebitda),      good: "neutral" },
    { label: "P/B",         value: fmtNum(km.pb_ratio),       good: km.pb_ratio != null && km.pb_ratio < 3 ? "good" : km.pb_ratio > 10 ? "bad" : "neutral" },
    { label: "P/S",         value: fmtNum(km.ps_ratio),       good: "neutral" },
    { label: "Beta",        value: fmtNum(km.beta),           good: "neutral" },
    { label: "ROE",         value: fmtPct(km.roe),            good: km.roe != null && km.roe > 0.15 ? "good" : km.roe < 0 ? "bad" : "neutral" },
    { label: "Net Margin",  value: fmtPct(km.profit_margin),  good: km.profit_margin != null && km.profit_margin > 0.1 ? "good" : km.profit_margin < 0 ? "bad" : "neutral" },
    { label: "Rev. Growth", value: fmtPct(km.revenue_growth), good: km.revenue_growth != null && km.revenue_growth > 0.05 ? "good" : km.revenue_growth < 0 ? "bad" : "neutral" },
    { label: "Div. Yield",  value: fmtPct(km.dividend_yield), good: "neutral" },
    { label: "EPS",         value: km.eps != null ? `$${fmtNum(km.eps)}` : "—", good: km.eps != null && km.eps > 0 ? "good" : "neutral" },
  ];

  const METRIC_COLORS = { good: "var(--green2)", bad: "var(--red2)", neutral: "var(--text)" };

  return (
    <motion.div
      className="ch-wrap"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="ch-top">
        <div className="ch-left">
          <div className="ch-title-row">
            <h1 className="ch-name">{data.company_name}</h1>
            <span className="ch-ticker mono">{data.ticker}</span>
            {data.confidence && (
              <span
                className="ch-confidence"
                style={{ color: conf.color, background: conf.bg, borderColor: conf.border }}
              >
                {data.confidence} Confidence
              </span>
            )}
          </div>
          <div className="ch-badges">
            {data.sector && <span className="ch-badge ch-badge--sector">{data.sector}</span>}
            {data.company_type && <span className="ch-badge ch-badge--type">{data.company_type}</span>}
            {data.industry && <span className="ch-badge ch-badge--industry">{data.industry}</span>}
          </div>
          {data.description && (
            <p className="ch-desc">{data.description.slice(0, 260)}…</p>
          )}
          {data.website && (
            <a href={data.website.startsWith('http://') || data.website.startsWith('https://') ? data.website : `https://${data.website}`} target="_blank" rel="noreferrer" className="ch-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              {data.website.replace(/https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
        </div>

        <div className="ch-right">
          <span className="ch-price-label">Live Price</span>
          <span className="ch-price mono">${data.current_price?.toFixed(2)}</span>
          {data.market_cap && (
            <div className="ch-mktcap">
              <span className="ch-mktcap-label">Mkt Cap</span>
              <span className="ch-mktcap-val mono">{fmt(data.market_cap)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics strip */}
      <div className="ch-metrics">
        {metrics.map((m, i) => (
          <div key={i} className="ch-metric">
            <span className="ch-metric-label">{m.label}</span>
            <span className="ch-metric-value mono" style={{ color: METRIC_COLORS[m.good] || "var(--text)" }}>
              {m.value}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        .ch-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .ch-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 20px;
          padding: 24px 26px 20px;
        }
        .ch-left { flex: 1; min-width: 240px; }
        .ch-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .ch-name {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.5px;
        }
        .ch-ticker {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--primary2);
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.2);
          padding: 3px 9px;
          border-radius: 5px;
          letter-spacing: 0.5px;
        }
        .ch-confidence {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 20px;
          border: 1px solid;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .ch-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .ch-badge {
          font-size: 0.7rem;
          padding: 3px 9px;
          border-radius: 5px;
          font-weight: 500;
          letter-spacing: 0.2px;
        }
        .ch-badge--sector {
          background: rgba(59,130,246,0.07);
          color: var(--primary2);
          border: 1px solid rgba(59,130,246,0.15);
        }
        .ch-badge--type {
          background: rgba(217,119,6,0.07);
          color: var(--yellow2);
          border: 1px solid rgba(217,119,6,0.15);
        }
        .ch-badge--industry {
          background: var(--surface2);
          color: var(--text3);
          border: 1px solid var(--border);
        }
        .ch-desc {
          font-size: 0.79rem;
          color: var(--text2);
          line-height: 1.7;
          margin-bottom: 10px;
          max-width: 580px;
        }
        .ch-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.73rem;
          color: var(--primary2);
          text-decoration: none;
          opacity: 0.8;
          transition: opacity 0.15s;
        }
        .ch-link:hover { opacity: 1; text-decoration: underline; }

        .ch-right { text-align: right; flex-shrink: 0; }
        .ch-price-label {
          display: block;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text3);
          margin-bottom: 4px;
        }
        .ch-price {
          display: block;
          font-size: 2.2rem;
          font-weight: 700;
          letter-spacing: -1.5px;
          color: var(--text);
          line-height: 1;
          margin-bottom: 8px;
        }
        .ch-mktcap {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .ch-mktcap-label {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--text3);
        }
        .ch-mktcap-val {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text2);
        }

        .ch-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
          border-top: 1px solid var(--border);
          background: var(--surface2);
        }
        .ch-metric {
          padding: 11px 16px;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .ch-metric:last-child { border-right: none; }
        .ch-metric-label {
          font-size: 0.62rem;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .ch-metric-value {
          font-size: 0.88rem;
          font-weight: 600;
        }

        @media (max-width: 640px) {
          .ch-top { padding: 16px; }
          .ch-metrics { grid-template-columns: repeat(5, 1fr); }
          .ch-price { font-size: 1.8rem; }
        }
      `}</style>
    </motion.div>
  );
}

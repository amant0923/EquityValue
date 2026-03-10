import { useState, useEffect } from "react";
import api from "../lib/api";

const fmt = (v, type) => {
  if (v == null || isNaN(v)) return <span style={{color:"var(--text3)"}}>—</span>;
  if (type === "x")    return `${Number(v).toFixed(1)}x`;
  if (type === "pct")  return `${(v*100).toFixed(1)}%`;
  if (type === "price")return `$${Number(v).toFixed(2)}`;
  if (type === "cap") {
    const a = Math.abs(v);
    if (a >= 1e12) return `$${(v/1e12).toFixed(2)}T`;
    if (a >= 1e9)  return `$${(v/1e9).toFixed(2)}B`;
    if (a >= 1e6)  return `$${(v/1e6).toFixed(2)}M`;
    return `$${v}`;
  }
  return String(v);
};

// Compute median of array (ignoring nulls)
function median(arr) {
  const clean = arr.filter(v => v != null && !isNaN(v)).sort((a,b) => a-b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid-1]+clean[mid])/2;
}

const COLS = [
  { key:"market_cap",    label:"Mkt Cap",       type:"cap",  desc:"Market capitalisation" },
  { key:"pe_ratio",      label:"P/E",            type:"x",   desc:"Price / Trailing EPS" },
  { key:"forward_pe",    label:"Fwd P/E",        type:"x",   desc:"Price / Forward EPS" },
  { key:"ev_ebitda",     label:"EV/EBITDA",      type:"x",   desc:"Enterprise Value / EBITDA" },
  { key:"ev_revenue",    label:"EV/Rev",         type:"x",   desc:"Enterprise Value / Revenue" },
  { key:"ps_ratio",      label:"P/S",            type:"x",   desc:"Price / Sales" },
  { key:"pb_ratio",      label:"P/B",            type:"x",   desc:"Price / Book" },
  { key:"revenue_growth",label:"Rev Growth",     type:"pct", desc:"YoY revenue growth" },
  { key:"ebitda_margin", label:"EBITDA Mgn",     type:"pct", desc:"EBITDA / Revenue" },
  { key:"profit_margin", label:"Net Margin",     type:"pct", desc:"Net Income / Revenue" },
  { key:"roe",           label:"ROE",            type:"pct", desc:"Return on Equity" },
  { key:"beta",          label:"Beta",           type:"x",   desc:"Market beta (volatility vs S&P 500)" },
];

function RelativeBar({ value, median, type, higher_is_better = true }) {
  if (value == null || median == null || median === 0) return null;
  const ratio = (value - median) / Math.abs(median);
  const capped = Math.max(-1, Math.min(1, ratio));
  const isPremium = capped > 0;
  const isGood = higher_is_better ? isPremium : !isPremium;
  const color = isGood ? "var(--green2)" : "var(--red2)";
  const width = Math.abs(capped) * 40;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"4px", marginTop:"2px" }}>
      <div style={{ width:"40px", height:"3px", background:"var(--surface3)", borderRadius:"2px", position:"relative" }}>
        <div style={{
          position:"absolute",
          height:"100%",
          width:`${width}px`,
          background: color,
          borderRadius:"2px",
          left: isPremium ? "50%" : `${50-width}%`,
        }} />
        <div style={{ position:"absolute", left:"50%", top:"-1px", width:"1px", height:"5px", background:"var(--border2)" }} />
      </div>
      <span style={{ fontSize:"0.58rem", color, fontWeight:600 }}>
        {isPremium ? "+" : ""}{(ratio*100).toFixed(0)}%
      </span>
    </div>
  );
}

export default function CompsTable({ ticker }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [fetched, setFetched] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    api.get(`/comps/${ticker}`)
      .then(r => { setData(r.data); setFetched(true); })
      .catch(() => setError("Failed to load comparable company data."))
      .finally(() => setLoading(false));
  };

  // Compute medians across peers only
  const peerMedians = {};
  if (data) {
    COLS.forEach(({ key }) => {
      peerMedians[key] = median(data.peers.map(p => p[key]));
    });
  }

  const allRows = data ? [data.subject, ...data.peers] : [];

  // Higher is better for: revenue_growth, ebitda_margin, profit_margin, roe
  // Lower is better for: pe, forward_pe, ev_ebitda, ev_revenue, ps, pb, beta
  const higherBetter = new Set(["revenue_growth","ebitda_margin","profit_margin","roe","dividend_yield"]);

  return (
    <div className="ct-wrap">
      <div className="ct-header">
        <div>
          <span className="ct-title">Comparable Company Analysis</span>
          <span className="ct-sub">Live sector peer multiples — subject company vs peer group median</span>
        </div>
        {!fetched && !loading && (
          <button className="ct-load-btn" onClick={load}>Load Comps</button>
        )}
        {fetched && !loading && (
          <button className="ct-load-btn ct-load-btn--refresh" onClick={load}>↻ Refresh</button>
        )}
      </div>

      {!fetched && !loading && !error && (
        <div className="ct-empty">
          <p>Click <strong>Load Comps</strong> to fetch live data for {ticker}'s sector peers.</p>
          <p className="ct-empty-sub">Pulls 6 liquid sector peers — typically takes 10–15 seconds</p>
        </div>
      )}

      {loading && (
        <div className="ct-loading">
          <div className="ct-spinner" />
          <span>Fetching sector peer data — this takes ~15 seconds…</span>
        </div>
      )}

      {error && <div className="ct-error">{error}</div>}

      {data && !loading && (
        <>
          <div className="ct-table-wrap">
            <table className="ct-table">
              <thead>
                <tr>
                  <th className="ct-th ct-th--company">Company</th>
                  {COLS.map(c => (
                    <th key={c.key} className="ct-th" title={c.desc}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Peer median row */}
                <tr className="ct-median-row">
                  <td className="ct-td ct-td--label">
                    <span className="ct-median-badge">Peer Median</span>
                  </td>
                  {COLS.map(({ key, type }) => (
                    <td key={key} className="ct-td ct-td--median">
                      {fmt(peerMedians[key], type)}
                    </td>
                  ))}
                </tr>

                {allRows.map((row, ri) => (
                  <tr key={row.ticker} className={`ct-row ${row.is_subject ? "ct-row--subject" : ""}`}>
                    <td className="ct-td ct-td--company">
                      <span className="ct-ticker">{row.ticker}</span>
                      {row.is_subject && <span className="ct-subject-badge">Subject</span>}
                      <span className="ct-name">{row.name?.split(" ").slice(0,3).join(" ")}</span>
                    </td>
                    {COLS.map(({ key, type }) => (
                      <td key={key} className={`ct-td ct-td--num ${row.is_subject ? "ct-td--subject" : ""}`}>
                        <div>{fmt(row[key], type)}</div>
                        {row.is_subject && peerMedians[key] != null && row[key] != null && (
                          <RelativeBar
                            value={row[key]}
                            median={peerMedians[key]}
                            type={type}
                            higher_is_better={higherBetter.has(key)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Premium / discount summary for subject */}
          <div className="ct-summary">
            <span className="ct-summary-label">Premium / Discount vs Peer Median</span>
            <div className="ct-summary-pills">
              {COLS.filter(c => ["pe_ratio","ev_ebitda","ps_ratio","revenue_growth","ebitda_margin"].includes(c.key))
                .map(({ key, label }) => {
                  const sv = data.subject[key];
                  const mv = peerMedians[key];
                  if (sv == null || mv == null || mv === 0) return null;
                  const pct = ((sv - mv) / Math.abs(mv)) * 100;
                  const isPremium = pct > 0;
                  const isGood = higherBetter.has(key) ? isPremium : !isPremium;
                  const color = isGood ? "var(--green2)" : "var(--red2)";
                  return (
                    <div key={key} className="ct-pill" style={{ borderColor: color+"33", background: color+"0d" }}>
                      <span className="ct-pill-label">{label}</span>
                      <span className="ct-pill-val" style={{ color }}>
                        {isPremium ? "+" : ""}{pct.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}

      <style>{`
        .ct-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .ct-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .ct-title { display: block; font-size: 0.72rem; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
        .ct-sub { font-size: 0.7rem; color: var(--text3); }
        .ct-load-btn { background: var(--primary); color: white; border: none; padding: 9px 20px; border-radius: var(--radius); font-size: 0.78rem; font-weight: 700; cursor: pointer; font-family: inherit; letter-spacing: 0.3px; transition: background 0.15s; white-space: nowrap; }
        .ct-load-btn:hover { background: var(--primary2); }
        .ct-load-btn--refresh { background: var(--surface2); color: var(--text2); border: 1px solid var(--border2); }
        .ct-load-btn--refresh:hover { background: var(--surface3); }
        .ct-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 48px 32px; text-align: center; border: 1px dashed var(--border2); border-radius: var(--radius); color: var(--text2); font-size: 0.82rem; line-height: 1.6; }
        .ct-empty-sub { font-size: 0.72rem; color: var(--text3); }
        .ct-loading { display: flex; align-items: center; gap: 14px; padding: 32px; color: var(--text3); font-size: 0.8rem; }
        .ct-spinner { width: 22px; height: 22px; border: 2px solid var(--border2); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ct-error { background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.2); color: var(--red2); padding: 14px 18px; border-radius: var(--radius); font-size: 0.78rem; }
        .ct-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
        .ct-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; white-space: nowrap; }
        .ct-th { padding: 9px 12px; text-align: right; font-size: 0.65rem; font-weight: 700; color: var(--text3); border-bottom: 1px solid var(--border); background: var(--surface2); letter-spacing: 0.3px; cursor: default; }
        .ct-th--company { text-align: left; min-width: 160px; }
        .ct-median-row td { background: rgba(37,99,235,0.04); border-bottom: 2px solid var(--border2); }
        .ct-median-badge { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--primary2); background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.15); padding: 2px 6px; border-radius: 3px; }
        .ct-td { padding: 8px 12px; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: top; }
        .ct-td--label { }
        .ct-td--median { text-align: right; font-weight: 700; color: var(--primary2); font-size: 0.75rem; }
        .ct-td--num { text-align: right; font-size: 0.75rem; }
        .ct-td--subject { background: rgba(37,99,235,0.03); }
        .ct-row--subject { border-left: 2px solid var(--primary); }
        .ct-row--subject .ct-td { font-weight: 600; }
        .ct-td--company { text-align: left; }
        .ct-ticker { font-weight: 800; font-size: 0.78rem; color: var(--text); display: block; }
        .ct-name { font-size: 0.65rem; color: var(--text3); display: block; margin-top: 1px; white-space: normal; max-width: 140px; }
        .ct-subject-badge { font-size: 0.55rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--primary2); background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.2); padding: 1px 5px; border-radius: 2px; margin-left: 6px; vertical-align: middle; }
        .ct-summary { display: flex; flex-direction: column; gap: 10px; }
        .ct-summary-label { font-size: 0.65rem; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 0.6px; }
        .ct-summary-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .ct-pill { display: flex; flex-direction: column; gap: 2px; padding: 8px 14px; border: 1px solid; border-radius: var(--radius); min-width: 80px; }
        .ct-pill-label { font-size: 0.62rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.4px; }
        .ct-pill-val { font-size: 0.9rem; font-weight: 800; }
      `}</style>
    </div>
  );
}

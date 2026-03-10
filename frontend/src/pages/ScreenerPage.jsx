import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import api from "../lib/api";

const SECTORS = ["All Sectors", "Technology", "Healthcare", "Financial Services", "Consumer Cyclical", "Consumer Defensive", "Energy", "Industrials", "Basic Materials", "Real Estate", "Utilities", "Communication Services"];

const FILTERS = [
  { key: "pe_ratio",      label: "P/E Ratio",    type: "range", min: 0,   max: 100,  step: 1   },
  { key: "pb_ratio",      label: "P/B Ratio",    type: "range", min: 0,   max: 50,   step: 0.5 },
  { key: "roe",           label: "ROE (%)",       type: "range", min: -50, max: 100,  step: 1   },
  { key: "revenue_growth",label: "Rev. Growth (%)", type: "range", min: -50, max: 200, step: 1 },
  { key: "market_cap",    label: "Mkt Cap ($B)",  type: "range", min: 0,   max: 3000, step: 10  },
];

export default function ScreenerPage({ onSearch, onGoAnalysis }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sector, setSector] = useState("All Sectors");
  const [searched, setSearched] = useState(false);

  const runScreener = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (sector !== "All Sectors") params.set("sector", sector);
      const res = await api.get(`/screener?${params}`);
      setResults(res.data.results || []);
    } catch (e) {
      console.error("Screener fetch error:", e);
      setResults([]);
    }
    setLoading(false);
  };

  const fmtNum = v => v != null ? Number(v).toFixed(2) : "—";
  const fmtPct = v => v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—";
  const fmtMktCap = v => v != null && v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v != null ? `$${(v / 1e6).toFixed(0)}M` : "—";

  return (
    <div className="sc-wrap">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="sc-header">
          <div>
            <h1 className="sc-title">Stock Screener</h1>
            <p className="sc-sub">Filter S&amp;P 500 stocks by sector and fundamentals</p>
          </div>
        </div>

        {/* Filters */}
        <div className="sc-filters">
          <div className="sc-filter-group">
            <label className="sc-filter-label">Sector</label>
            <select
              className="sc-select"
              value={sector}
              onChange={e => setSector(e.target.value)}
            >
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button className="sc-run-btn" onClick={runScreener} disabled={loading}>
            {loading ? (
              <span className="sc-spinner" />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Run Screener
              </>
            )}
          </button>
        </div>

        {searched && results.length === 0 && !loading && (
          <div className="sc-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p>No stocks found matching your criteria. Try a different sector or fewer filters.</p>
          </div>
        )}

        {/* Results table */}
        {results.length > 0 && (
          <div className="sc-table-wrap">
            <div className="sc-results-count">{results.length} stocks match your criteria</div>
            <div className="sc-table-scroll">
              <table className="sc-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Company</th>
                    <th>Sector</th>
                    <th>Price</th>
                    <th>Mkt Cap</th>
                    <th>P/E</th>
                    <th>P/B</th>
                    <th>ROE</th>
                    <th>Rev. Growth</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="sc-row" onClick={() => { onGoAnalysis(); onSearch(r.ticker); }}>
                      <td className="sc-ticker mono">{r.ticker}</td>
                      <td className="sc-name">{r.company_name || r.name}</td>
                      <td className="sc-sector">{r.sector || "—"}</td>
                      <td className="mono">${fmtNum(r.current_price)}</td>
                      <td className="mono">{fmtMktCap(r.market_cap)}</td>
                      <td className="mono">{fmtNum(r.pe_ratio)}</td>
                      <td className="mono">{fmtNum(r.pb_ratio)}</td>
                      <td className={`mono ${r.roe > 0.15 ? "sc-good" : r.roe < 0 ? "sc-bad" : ""}`}>{fmtPct(r.roe)}</td>
                      <td className={`mono ${r.revenue_growth > 0.05 ? "sc-good" : r.revenue_growth < 0 ? "sc-bad" : ""}`}>{fmtPct(r.revenue_growth)}</td>
                      <td>
                        <button className="sc-analyse-btn">Analyse →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!searched && (
          <div className="sc-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <p>Select filters and click <strong>Run Screener</strong> to find stocks</p>
          </div>
        )}
      </motion.div>

      <style>{`
        .sc-wrap { max-width: 1100px; }
        .sc-header { margin-bottom: 28px; }
        .sc-title { font-size: 1.6rem; font-weight: 700; color: var(--text); letter-spacing: -0.8px; margin-bottom: 4px; }
        .sc-sub { font-size: 0.85rem; color: var(--text2); }

        .sc-filters {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px 24px;
          display: flex;
          align-items: flex-end;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }
        .sc-filter-group { display: flex; flex-direction: column; gap: 6px; }
        .sc-filter-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); }
        .sc-select {
          background: var(--surface2);
          border: 1px solid var(--border2);
          color: var(--text);
          padding: 8px 12px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.85rem;
          cursor: pointer;
          outline: none;
          min-width: 180px;
        }
        .sc-select:focus { border-color: var(--primary); }

        .sc-run-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--primary);
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
          white-space: nowrap;
        }
        .sc-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sc-run-btn:hover:not(:disabled) { opacity: 0.85; }
        .sc-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .sc-notice {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          background: rgba(245,158,11,0.06);
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: var(--radius-lg);
          padding: 18px 20px;
          margin-bottom: 24px;
          font-size: 0.83rem;
          color: var(--text2);
          line-height: 1.65;
        }
        .sc-notice strong { display: block; margin-bottom: 4px; color: var(--yellow2); }
        .sc-notice code { background: var(--surface2); padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.8rem; }

        .sc-results-count { font-size: 0.78rem; color: var(--text3); margin-bottom: 12px; }
        .sc-table-scroll { overflow-x: auto; }
        .sc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .sc-table th {
          padding: 10px 14px;
          text-align: left;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--text3);
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .sc-table td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .sc-row { cursor: pointer; transition: background 0.12s; }
        .sc-row:hover td { background: var(--surface2); }
        .sc-ticker { font-weight: 700; color: var(--primary2); }
        .sc-name { color: var(--text); max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
        .sc-sector { color: var(--text3); font-size: 0.75rem; }
        .sc-good { color: var(--green2); }
        .sc-bad { color: var(--red2); }
        .sc-analyse-btn {
          background: transparent;
          border: 1px solid var(--border2);
          color: var(--primary2);
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.12s;
        }
        .sc-analyse-btn:hover { background: var(--primary-glow2); border-color: var(--primary); }

        .sc-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 60px 20px;
          color: var(--text3);
          font-size: 0.85rem;
          text-align: center;
        }
        .sc-empty strong { color: var(--text2); }
      `}</style>
    </div>
  );
}

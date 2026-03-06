import { useState, useEffect } from "react";
import axios from "axios";
import SearchBar from "./components/SearchBar";
import CompanyHeader from "./components/CompanyHeader";
import ConsensusCard from "./components/ConsensusCard";
import ValuationCard from "./components/ValuationCard";
import ValuationChart from "./components/ValuationChart";
import PriceChart from "./components/PriceChart";
import SensitivityTable from "./components/SensitivityTable";
import PeerComparison from "./components/PeerComparison";
import AnalystPanel from "./components/AnalystPanel";
import FundamentalsPanel from "./components/FundamentalsPanel";
import FootballField from "./components/FootballField";
import ThreeStatementModel from "./components/ThreeStatementModel";
import MonteCarlo from "./components/MonteCarlo";
import LBOModel from "./components/LBOModel";
import InvestmentThesis from "./components/InvestmentThesis";
import CompsTable from "./components/CompsTable";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const ALL_MODELS = [
  { name: "DCF (Discounted Cash Flow)",    category: "Income-Based",  color: "blue",   desc: "Projects future Free Cash Flows and discounts them to present value using a risk-adjusted WACC. Widely regarded as the most rigorous fundamental valuation method.", best: "Profitable companies with stable, growing free cash flow" },
  { name: "Capitalization of Earnings",     category: "Income-Based",  color: "blue",   desc: "Divides normalised annual earnings by a sector-appropriate capitalisation rate. Reliable for companies with predictable earnings streams.", best: "Stable, mature companies with consistent earnings" },
  { name: "Gordon Growth Model (DDM)",      category: "Income-Based",  color: "blue",   desc: "Values equity as the present value of an infinite stream of dividends growing at a constant rate. A cornerstone of equity income analysis.", best: "Dividend-paying companies with consistent payout histories" },
  { name: "Residual Income",                category: "Income-Based",  color: "blue",   desc: "Values a company as book value plus the present value of all future earnings in excess of the required equity return.", best: "Companies where earnings consistently exceed the cost of equity" },
  { name: "EV/EBITDA Comparables",          category: "Market-Based",  color: "purple", desc: "Applies the sector median EV/EBITDA multiple to the company's EBITDA, adjusting for net debt to arrive at intrinsic equity value per share.", best: "Capital-intensive businesses; cross-sector M&A comparisons" },
  { name: "EV/EBIT Comparables",            category: "Market-Based",  color: "purple", desc: "Like EV/EBITDA but excludes depreciation and amortisation — a cleaner operational profitability measure for asset-light businesses.", best: "Asset-light companies where D&A materially distorts EBITDA" },
  { name: "EV/Sales Comparables",           category: "Market-Based",  color: "purple", desc: "Applies the sector median EV/Revenue multiple. Valuable when earnings are negative but the company demonstrates meaningful revenue.", best: "High-growth or pre-profit companies" },
  { name: "P/E Comparables",                category: "Market-Based",  color: "purple", desc: "Multiplies trailing EPS by the sector median P/E ratio. The most widely cited equity valuation metric in institutional research.", best: "Profitable companies in well-covered public markets" },
  { name: "P/S Comparables",                category: "Market-Based",  color: "purple", desc: "Multiplies revenue per share by the sector median Price/Sales ratio. Cuts through earnings distortions to focus on top-line value.", best: "High-revenue businesses, early-stage and loss-making companies" },
  { name: "PEG Ratio",                      category: "Market-Based",  color: "purple", desc: "Adjusts the P/E ratio by the earnings growth rate. A PEG of 1.0 implies fair value — below 1.0 suggests undervaluation relative to growth.", best: "High-growth companies where a static P/E overstates valuation" },
  { name: "Price-to-Book (P/B)",            category: "Asset-Based",   color: "green",  desc: "Calculates a theoretically justified P/B multiple using ROE relative to cost of equity, applied to book value per share.", best: "Banks, insurers and asset-heavy financial companies" },
  { name: "Graham Number",                  category: "Asset-Based",   color: "green",  desc: "Benjamin Graham's formula: the geometric mean of 15x earnings and 1.5x book value. A conservative margin-of-safety benchmark.", best: "Value investors seeking a conservative floor estimate" },
];

const CATEGORY_META = {
  "Income-Based":  { color: "blue",   desc: "Values a company by its capacity to generate future earnings or cash flows, discounted to a present value using an appropriate risk-adjusted rate." },
  "Market-Based":  { color: "purple", desc: "Compares the company against sector peers using standardised market multiples — reflecting what the market currently pays for similar businesses." },
  "Asset-Based":   { color: "green",  desc: "Values the company on the basis of its net asset position — what it owns minus what it owes — adjusted for market or replacement value." },
};

const STATS = [
  { value: "12", label: "Valuation Models" },
  { value: "3",  label: "Methodologies" },
  { value: "Live", label: "Market Data" },
  { value: "~3s", label: "Per Analysis" },
];

// FIX: safe localStorage helpers — won't crash if storage is unavailable
const lsGet = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const lsSet = (key, val)      => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

export default function App() {
  const [ticker, setTicker]         = useState("");
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [theme, setTheme]           = useState("dark");
  const [disclaimer, setDisclaimer] = useState(false);
  const [memoText, setMemoText] = useState("");
  const [mcStats, setMcStats] = useState(null);
  const [lboStats, setLboStats] = useState(null);
  const [watchlist, setWatchlist]   = useState([]);

  useEffect(() => {
    // FIX: wrapped in try/catch via lsGet
    if (!lsGet("ve_disclaimer", null)) setDisclaimer(true);
    setWatchlist(lsGet("ve_watchlist", []));
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.body.classList.toggle("light", next === "light");
  };

  const handleSearch = async (t) => {
    const sym = (t || ticker).trim().toUpperCase();
    if (!sym) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await axios.get(`${API}/valuation/${sym}`);
      setResult(res.data);
      const wl = lsGet("ve_watchlist", []);
      if (!wl.includes(sym)) {
        const updated = [sym, ...wl].slice(0, 8);
        lsSet("ve_watchlist", updated);
        setWatchlist(updated);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to fetch data. Check the ticker and try again.");
    } finally {
      setLoading(false);
    }
  };

  const removeFromWatchlist = (sym, e) => {
    e.stopPropagation();
    const updated = watchlist.filter(s => s !== sym);
    lsSet("ve_watchlist", updated);
    setWatchlist(updated);
  };

  const exportPDF = () => window.print();

  // FIX: guard against null valuations array
  const applicable    = result?.valuations?.filter(v => v?.applicable) || [];
  const notApplicable = result?.valuations?.filter(v => v && !v.applicable) || [];
  const usedNames     = result?.valuations?.map(v => v?.model).filter(Boolean) || [];
  const unusedModels  = ALL_MODELS.filter(m => !usedNames.includes(m.name));

  return (
    <div className="app">
      {disclaimer && (
        <div className="disclaimer-overlay">
          <div className="disclaimer-modal">
            <div className="disclaimer-logo">
              <div className="disclaimer-logo-mark">
                <svg viewBox="0 0 16 16" fill="none"><polyline points="1,12 5,7 9,10 15,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="disclaimer-logo-text">ValuEngine</span>
            </div>
            <h2 className="disclaimer-title">Important Notice</h2>
            <div className="disclaimer-body">
              <p>ValuEngine is an analytical tool designed to assist in the research and study of equity valuation methodologies. It does not constitute financial advice, investment recommendations, or an offer to buy or sell any security.</p>
              <p>Intrinsic value estimates are derived from publicly available financial data and standardised valuation models. They are inherently based on assumptions that may not reflect actual market conditions or future performance.</p>
              <p>You should not make investment decisions based solely on this tool. Always conduct your own due diligence and consult a qualified financial adviser before investing.</p>
            </div>
            <button className="disclaimer-btn" onClick={() => { setDisclaimer(false); lsSet("ve_disclaimer", "1"); }}>
              I understand — Continue to ValuEngine
            </button>
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="header-left">
          <div className="logo-mark">
            <svg viewBox="0 0 16 16" fill="none"><polyline points="1,12 5,7 9,10 15,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          </div>
          <span className="logo-text">ValuEngine</span>
          <div className="logo-divider" />
          <span className="logo-sub">Equity Valuation Platform</span>
        </div>
        <div className="header-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button className="theme-toggle" onClick={toggleTheme}>{theme === "dark" ? "Light Mode" : "Dark Mode"}</button>
          <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>For informational purposes only</span>
        </div>
      </header>

      <main className="app-main">

        {watchlist.length > 0 && (
          <div className="watchlist" style={{ marginBottom: "24px" }}>
            <span className="watchlist-label">Recent</span>
            {watchlist.map(sym => (
              <div key={sym} className="watchlist-item" onClick={() => { setTicker(sym); handleSearch(sym); }}>
                {sym}
                <button className="watchlist-remove" onClick={e => removeFromWatchlist(sym, e)}>×</button>
              </div>
            ))}
          </div>
        )}

        {!result && !loading && (
          <div className="landing">
            <div className="landing-hero">
              <span className="hero-eyebrow">Institutional-Grade Equity Analysis</span>
              <h1 className="hero-title">Know what a stock is <span>actually worth</span></h1>
              <p className="hero-sub">ValuEngine applies up to 12 valuation models simultaneously — spanning income, market and asset-based methodologies — synthesising them into a single consensus verdict in seconds.</p>
              <div className="hero-stats">
                {STATS.map((s, i) => (
                  <div key={i} className="hero-stat">
                    <span className="hero-stat-value">{s.value}</span>
                    <span className="hero-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="search-wrap">
              <SearchBar ticker={ticker} setTicker={setTicker} onSearch={handleSearch} loading={loading} />
              <div className="example-tickers">
                {["AAPL","NVDA","TSLA","KO","JPM","MSFT"].map(t => (
                  <button key={t} className="ticker-pill" onClick={() => { setTicker(t); handleSearch(t); }}>{t}</button>
                ))}
              </div>
            </div>

            <div className="methodology-section">
              <h2 className="section-heading">Three Methodologies. One Consensus.</h2>
              <p className="section-sub">Each category captures a distinct dimension of value. Professionals triangulate across all three to establish a defensible valuation range.</p>
              <div className="method-cards">
                {Object.entries(CATEGORY_META).map(([cat, meta], i) => {
                  const models = ALL_MODELS.filter(m => m.category === cat);
                  return (
                    <div key={i} className="method-card">
                      <div className="method-card-header">
                        <span className={`method-badge method-badge--${meta.color}`}>{cat}</span>
                        <span className="method-count">{models.length} models</span>
                      </div>
                      <p className="method-desc">{meta.desc}</p>
                      <ul className="method-model-list">
                        {models.map((m, j) => (
                          <li key={j}><div className={`method-model-dot method-model-dot--${meta.color}`} />{m.name}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="all-models-section">
              <h2 className="section-heading">All 12 Valuation Models</h2>
              <p className="section-sub">Models are selected automatically based on each company's sector, profitability profile and available financial data.</p>
              <div className="model-detail-grid">
                {ALL_MODELS.map((m, i) => (
                  <div key={i} className="model-detail-card">
                    <div className="mdc-top">
                      <span className="mdc-number">{String(i + 1).padStart(2, "0")}</span>
                      <span className={`method-badge method-badge--${m.color} method-badge--sm`}>{m.category}</span>
                    </div>
                    <h3 className="mdc-name">{m.name}</h3>
                    <p className="mdc-desc">{m.desc}</p>
                    <div className="mdc-best"><span className="mdc-best-label">Best for: </span>{m.best}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="expert-tip">
              <div>
                <div className="expert-tip-label">Expert Note</div>
                <strong>Triangulate, do not isolate</strong>
                <p>In M&A and institutional investment contexts, no single model is treated as definitive. Income-based, market-based and asset-based methods each carry different assumptions. ValuEngine's consensus score aggregates all applicable models to produce a more robust, defensible estimate of intrinsic value.</p>
              </div>
            </div>
          </div>
        )}

        {(result || loading || error) && (
          <div className="search-wrap search-wrap--compact" style={{position:"relative"}}>
            <button
              className="pdf-export-btn"
              title="Export PDF Report"
              onClick={async () => {
                try {
                  const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/pdf/export`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ data: result, memo: memoText, monte_carlo: mcStats, lbo: lboStats }),
                  });
                  if (!res.ok) throw new Error("PDF generation failed");
                  const html = await res.text();
                  const blob = new Blob([html], { type: "text/html" });
                  const url  = URL.createObjectURL(blob);
                  const win  = window.open(url, "_blank");
                  if (win) win.onload = () => { win.focus(); win.print(); };
                } catch(e) {
                  alert("PDF export failed: " + e.message);
                }
              }}
            >
              ↓ Export PDF
            </button>
            <SearchBar ticker={ticker} setTicker={setTicker} onSearch={handleSearch} loading={loading} />
          </div>
        )}

        {error   && <div className="error-box">{error}</div>}
        {loading && <div className="loading-box"><div className="spinner" /><span>Fetching data and running valuation models</span></div>}

        {result && !loading && (
          <div className="results">
            <CompanyHeader data={result} />
            <PriceChart ticker={result.ticker} currentPrice={result.current_price} />
            {result.consensus && <ConsensusCard data={result.consensus} />}
            {applicable.length > 0 && <ValuationChart valuations={applicable} currentPrice={result.current_price} />}

            {applicable.length > 0 && (
              <FootballField
                valuations={applicable}
                currentPrice={result.current_price}
                consensus={result.consensus}
              />
            )}
            <ThreeStatementModel data={result} />
            <MonteCarlo data={result} onStatsGenerated={setMcStats} />
            <LBOModel data={result} onResultGenerated={setLboStats} />
            <CompsTable ticker={result.ticker} />
            <InvestmentThesis data={result} onMemoGenerated={setMemoText} />

            <section className="valuations-section">
              <div className="results-header">
                <h2 className="section-title">Model Results</h2>
                <button className="export-btn" onClick={exportPDF}>Export PDF</button>
              </div>
              <div className="cards-grid">
                {applicable.map((v, i) => <ValuationCard key={i} data={v} />)}
              </div>
            </section>

            {result.dcf_sensitivity && <SensitivityTable data={result.dcf_sensitivity} currentPrice={result.current_price} />}
            {result.peer_comparison?.length > 0 && <PeerComparison data={result.peer_comparison} />}
            {result.analyst && <AnalystPanel data={result.analyst} />}
            <FundamentalsPanel data={result} />

            {notApplicable.length > 0 && (
              <section className="valuations-section">
                <h2 className="section-title muted-title">Not Applicable</h2>
                <div className="na-grid">
                  {notApplicable.map((v, i) => (
                    <div key={i} className="na-card">
                      <div className="na-card-name">{v.model}</div>
                      <div className="na-card-reason">{v.reason}</div>
                      {v.description && <div className="na-card-desc">{v.description}</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {unusedModels.length > 0 && (
              <section className="valuations-section">
                <h2 className="section-title muted-title">Not Selected for This Profile</h2>
                <div className="na-grid">
                  {unusedModels.map((m, i) => (
                    <div key={i} className="na-card">
                      <div className="na-card-top">
                        <span className="na-card-name">{m.name}</span>
                        <span className={`method-badge method-badge--${m.color} method-badge--sm`}>{m.category}</span>
                      </div>
                      <div className="na-card-desc">{m.desc}</div>
                      <div className="na-card-best"><span className="mdc-best-label">Best for: </span>{m.best}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>For informational purposes only. Not financial advice. ValuEngine does not constitute investment advice or a solicitation to buy or sell any security.</p>
      </footer>
    </div>
  );
}

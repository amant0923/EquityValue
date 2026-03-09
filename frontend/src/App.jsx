import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

import SearchBar from "./components/SearchBar";
import Sidebar from "./components/Sidebar";
import AnalysisSkeleton from "./components/SkeletonLoader";
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

import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import ScreenerPage from "./pages/ScreenerPage";
import MobileNav from "./components/MobileNav";

import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const ALL_MODELS = [
  { name: "DCF (Discounted Cash Flow)",    category: "Income-Based",  color: "blue" },
  { name: "Capitalization of Earnings",     category: "Income-Based",  color: "blue" },
  { name: "Gordon Growth Model (DDM)",      category: "Income-Based",  color: "blue" },
  { name: "Residual Income",                category: "Income-Based",  color: "blue" },
  { name: "EV/EBITDA Comparables",          category: "Market-Based",  color: "purple" },
  { name: "EV/EBIT Comparables",            category: "Market-Based",  color: "purple" },
  { name: "EV/Sales Comparables",           category: "Market-Based",  color: "purple" },
  { name: "P/E Comparables",                category: "Market-Based",  color: "purple" },
  { name: "P/S Comparables",                category: "Market-Based",  color: "purple" },
  { name: "PEG Ratio",                      category: "Market-Based",  color: "purple" },
  { name: "Price-to-Book (P/B)",            category: "Asset-Based",   color: "green" },
  { name: "Graham Number",                  category: "Asset-Based",   color: "green" },
];

const lsGet = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const lsSet = (key, val)      => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: "easeOut" },
};

export default function App() {
  // App shell state
  const [appMode, setAppMode]       = useState("landing"); // "landing" | "app"
  const [page, setPage]             = useState("dashboard"); // "dashboard"|"analysis"|"screener"|"compare"
  const [theme, setTheme]           = useState("dark");
  const [disclaimer, setDisclaimer] = useState(false);
  const [watchlist, setWatchlist]   = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Analysis state
  const [ticker, setTicker]     = useState("");
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [memoText, setMemoText] = useState("");
  const [mcStats, setMcStats]   = useState(null);
  const [lboStats, setLboStats] = useState(null);

  useEffect(() => {
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
    setPage("analysis");
    try {
      const res = await axios.get(`${API}/valuation/${sym}`);
      setResult(res.data);
      setTicker(sym);
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

  const enterApp = () => {
    setAppMode("app");
    setPage("analysis");
  };

  const applicable    = result?.valuations?.filter(v => v?.applicable) || [];
  const notApplicable = result?.valuations?.filter(v => v && !v.applicable) || [];
  const usedNames     = result?.valuations?.map(v => v?.model).filter(Boolean) || [];
  const unusedModels  = ALL_MODELS.filter(m => !usedNames.includes(m.name));

  const exportPDF = async () => {
    try {
      const res = await fetch(`${API}/pdf/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: result, memo: memoText || "", monte_carlo: mcStats || null, lbo: lboStats || null }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "PDF generation failed");
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${result.ticker}_ValuEngine.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch(e) { alert("PDF export failed: " + e.message); }
  };

  // ── Landing page ──────────────────────────────────────────────────────────
  if (appMode === "landing") {
    return (
      <>
        {disclaimer && <DisclaimerModal onAccept={() => { setDisclaimer(false); lsSet("ve_disclaimer", "1"); }} />}

        <div className="lp-shell">
          {/* Minimal landing header */}
          <header className="lp-header">
            <div className="lp-header-logo">
              <div className="lp-logo-mark">
                <svg viewBox="0 0 16 16" fill="none">
                  <polyline points="1,12 5,7 9,10 15,3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="lp-logo-text">ValuEngine</span>
            </div>
            <div className="lp-header-right">
              <button className="lp-nav-btn" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === "dark" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                )}
              </button>
              <button className="lp-nav-btn" onClick={() => { setAppMode("app"); setPage("dashboard"); }}>Dashboard</button>
              <button className="lp-nav-cta" onClick={enterApp}>Get Started →</button>
            </div>
          </header>

          <main>
            <LandingPage
              ticker={ticker}
              setTicker={setTicker}
              onSearch={handleSearch}
              loading={loading}
              onEnterApp={enterApp}
            />
          </main>

          <footer className="lp-footer">
            <p>For informational purposes only. Not financial advice. ValuEngine does not constitute investment advice or a solicitation to buy or sell any security.</p>
          </footer>
        </div>
      </>
    );
  }

  // ── App shell (with sidebar) ───────────────────────────────────────────────
  return (
    <>
      {disclaimer && <DisclaimerModal onAccept={() => { setDisclaimer(false); lsSet("ve_disclaimer", "1"); }} />}

      <div className="app-shell">
        <Sidebar
          page={page}
          setPage={(p) => {
            setPage(p);
            if (p === "analysis" && !result) setError("");
          }}
          onBackToLanding={() => setAppMode("landing")}
          onCollapseChange={setSidebarCollapsed}
        />

        <div className={`app-body${sidebarCollapsed ? " app-body--collapsed" : ""}`}>
          {/* Top bar */}
          <header className="app-topbar">
            <div className="topbar-left">
              {page === "analysis" && (
                <div className="topbar-search">
                  <SearchBar ticker={ticker} setTicker={setTicker} onSearch={handleSearch} loading={loading} />
                </div>
              )}
              {page !== "analysis" && (
                <div className="topbar-breadcrumb">
                  <span className="topbar-breadcrumb-home" onClick={() => setAppMode("landing")}>ValuEngine</span>
                  <span className="topbar-breadcrumb-sep">/</span>
                  <span className="topbar-breadcrumb-current">
                    {{ dashboard: "Dashboard", screener: "Screener", compare: "Compare" }[page] || page}
                  </span>
                </div>
              )}
            </div>
            <div className="topbar-right">
              {result && page === "analysis" && (
                <button className="topbar-pdf-btn" onClick={exportPDF} title="Export PDF" aria-label="Export PDF report">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export PDF
                </button>
              )}
              <button className="topbar-theme-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
                {theme === "dark" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                )}
              </button>
            </div>
          </header>

          {/* Mobile bottom nav */}
          <MobileNav page={page} setPage={(p) => {
            setPage(p);
            if (p === "analysis" && !result) setError("");
          }} />

          {/* Page content */}
          <main className="app-content">
            <AnimatePresence mode="wait">
              {page === "dashboard" && (
                <motion.div key="dashboard" {...pageTransition}>
                  <DashboardPage
                    watchlist={watchlist}
                    onSearch={handleSearch}
                    onGoAnalysis={() => setPage("analysis")}
                  />
                </motion.div>
              )}

              {page === "analysis" && (
                <motion.div key="analysis" {...pageTransition} className="analysis-page">
                  {!loading && !result && !error && (
                    <AnalysisEmpty onSearch={handleSearch} ticker={ticker} setTicker={setTicker} loading={loading} />
                  )}
                  {error && (
                    <div className="error-box">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      {error}
                    </div>
                  )}
                  {loading && <AnalysisSkeleton />}
                  {result && !loading && (
                    <AnalysisResults
                      result={result}
                      applicable={applicable}
                      notApplicable={notApplicable}
                      unusedModels={unusedModels}
                      onMemoGenerated={setMemoText}
                      onMcStats={setMcStats}
                      onLboStats={setLboStats}
                    />
                  )}
                </motion.div>
              )}

              {page === "screener" && (
                <motion.div key="screener" {...pageTransition}>
                  <ScreenerPage onSearch={handleSearch} onGoAnalysis={() => setPage("analysis")} />
                </motion.div>
              )}

              {page === "compare" && (
                <motion.div key="compare" {...pageTransition}>
                  <ComparePage onSearch={handleSearch} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DisclaimerModal({ onAccept }) {
  return (
    <motion.div
      className="disclaimer-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <motion.div
        className="disclaimer-modal"
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="disclaimer-logo">
          <div className="disclaimer-logo-mark">
            <svg viewBox="0 0 16 16" fill="none">
              <polyline points="1,12 5,7 9,10 15,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="disclaimer-logo-text">ValuEngine</span>
        </div>
        <h2 className="disclaimer-title">Important Legal Notice</h2>
        <div className="disclaimer-body">
          <p><strong>ValuEngine is not a registered financial adviser, broker, or investment firm.</strong> This platform is an independent analytical tool built for educational and research purposes only.</p>
          <p>Nothing on this platform constitutes financial advice, investment recommendations, or an offer of any kind. All intrinsic value estimates are illustrative only.</p>
          <p><strong>You should not make any investment decision based solely or partly on information provided by this tool.</strong> Always consult a qualified financial adviser.</p>
        </div>
        <button className="disclaimer-btn" onClick={onAccept}>
          I understand — Continue to ValuEngine
        </button>
      </motion.div>
    </motion.div>
  );
}

function AnalysisEmpty({ onSearch, ticker, setTicker, loading }) {
  const TICKERS = ["AAPL", "NVDA", "TSLA", "KO", "JPM", "MSFT"];
  return (
    <div className="ae-wrap">
      <div className="ae-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <h2 className="ae-title">Search for an S&amp;P 500 stock</h2>
      <p className="ae-sub">Enter a ticker or company name in the search bar above to run full institutional-grade analysis.</p>
      <div className="ae-tickers">
        <span className="ae-tickers-label">Quick picks:</span>
        {TICKERS.map(t => (
          <button key={t} className="ae-ticker-btn" onClick={() => { setTicker(t); onSearch(t); }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function AnalysisResults({ result, applicable, notApplicable, unusedModels, onMemoGenerated, onMcStats, onLboStats }) {
  const stagger = { visible: { transition: { staggerChildren: 0.06 } } };
  const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" } } };

  return (
    <motion.div className="results" initial="hidden" animate="visible" variants={stagger}>
      <motion.div variants={fadeUp}><CompanyHeader data={result} /></motion.div>
      <motion.div variants={fadeUp}><PriceChart ticker={result.ticker} currentPrice={result.current_price} /></motion.div>

      {result.consensus && (
        <motion.div variants={fadeUp}><ConsensusCard data={result.consensus} /></motion.div>
      )}

      {applicable.length > 0 && (
        <motion.div variants={fadeUp}><ValuationChart valuations={applicable} currentPrice={result.current_price} /></motion.div>
      )}
      {applicable.length > 0 && (
        <motion.div variants={fadeUp}>
          <FootballField valuations={applicable} currentPrice={result.current_price} consensus={result.consensus} />
        </motion.div>
      )}

      <motion.div variants={fadeUp}><ThreeStatementModel data={result} /></motion.div>
      <motion.div variants={fadeUp}><MonteCarlo data={result} onStatsGenerated={onMcStats} /></motion.div>
      <motion.div variants={fadeUp}><LBOModel data={result} onResultGenerated={onLboStats} /></motion.div>
      <motion.div variants={fadeUp}><CompsTable ticker={result.ticker} /></motion.div>
      <motion.div variants={fadeUp}><InvestmentThesis data={result} onMemoGenerated={onMemoGenerated} /></motion.div>

      {/* Model results */}
      <motion.section variants={fadeUp} className="valuations-section">
        <div className="results-header">
          <h2 className="section-title">Model Results</h2>
          <span className="results-count">{applicable.length} models applied</span>
        </div>
        <div className="cards-grid">
          {applicable.map((v, i) => <ValuationCard key={i} data={v} />)}
        </div>
      </motion.section>

      {result.dcf_sensitivity && (
        <motion.div variants={fadeUp}><SensitivityTable data={result.dcf_sensitivity} currentPrice={result.current_price} /></motion.div>
      )}
      {result.peer_comparison?.length > 0 && (
        <motion.div variants={fadeUp}><PeerComparison data={result.peer_comparison} /></motion.div>
      )}
      {result.analyst && (
        <motion.div variants={fadeUp}><AnalystPanel data={result.analyst} /></motion.div>
      )}
      <motion.div variants={fadeUp}><FundamentalsPanel data={result} /></motion.div>

      {notApplicable.length > 0 && (
        <motion.section variants={fadeUp} className="valuations-section">
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
        </motion.section>
      )}

      {unusedModels.length > 0 && (
        <motion.section variants={fadeUp} className="valuations-section">
          <h2 className="section-title muted-title">Not Selected for This Profile</h2>
          <div className="na-grid">
            {unusedModels.map((m, i) => (
              <div key={i} className="na-card">
                <div className="na-card-top">
                  <span className="na-card-name">{m.name}</span>
                  <span className={`method-badge method-badge--${m.color} method-badge--sm`}>{m.category}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}

function ComparePage() {
  return (
    <div className="cmp-wrap">
      <h1 className="cmp-title">Compare Stocks</h1>
      <p className="cmp-sub">Side-by-side comparison of up to 4 S&amp;P 500 stocks. Coming soon.</p>
      <div className="cmp-coming-soon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <p>The comparison tool will allow you to compare valuation metrics, charts, and fundamentals across multiple stocks simultaneously.</p>
      </div>
      <style>{`
        .cmp-wrap { max-width: 700px; }
        .cmp-title { font-size: 1.6rem; font-weight: 700; color: var(--text); letter-spacing: -0.8px; margin-bottom: 6px; }
        .cmp-sub { font-size: 0.85rem; color: var(--text2); margin-bottom: 40px; }
        .cmp-coming-soon {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 60px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          text-align: center;
          color: var(--text3);
          font-size: 0.85rem;
          max-width: 440px;
          line-height: 1.7;
        }
      `}</style>
    </div>
  );
}

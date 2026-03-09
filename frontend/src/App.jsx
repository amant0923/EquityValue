import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { supabase } from "./lib/supabase";
import AuthModal from "./components/AuthModal";
import UpgradeModal from "./components/UpgradeModal";
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
import LockedFeatureCard from "./components/LockedFeatureCard";

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
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const { user, profile, loading: authLoading, signOut, recordAnalysis, canAnalyse, isFeatureUnlocked, getToken } = useAuth();

  // App shell state
  const [appMode, setAppMode]       = useState("landing"); // "landing" | "app"
  const [page, setPage]             = useState("dashboard"); // "dashboard"|"analysis"|"screener"|"compare"
  const [theme, setTheme]           = useState("dark");
  const [disclaimer, setDisclaimer] = useState(false);
  const [watchlist, setWatchlist]   = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auth modals
  const [showAuth, setShowAuth]         = useState(false);
  const [authMode, setAuthMode]         = useState("login");
  const [showUpgrade, setShowUpgrade]   = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("limit");

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

    // Check if user is logged in
    if (!user) {
      setAuthMode("login");
      setShowAuth(true);
      return;
    }

    // Check daily limit
    if (!canAnalyse()) {
      setUpgradeReason("limit");
      setShowUpgrade(true);
      return;
    }

    setLoading(true); setError(""); setResult(null);
    setPage("analysis");
    try {
      const token = await getToken();
      const res = await axios.get(`${API}/valuation/${sym}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setResult(res.data);
      setTicker(sym);
      const wl = lsGet("ve_watchlist", []);
      if (!wl.includes(sym)) {
        const updated = [sym, ...wl].slice(0, 8);
        lsSet("ve_watchlist", updated);
        setWatchlist(updated);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      // If token was rejected, force a session refresh and retry once
      if (detail === "Invalid token" || detail === "Token expired" || detail === "Not authenticated") {
        try {
          const { data: refreshed } = await supabase.auth.refreshSession();
          const newToken = refreshed?.session?.access_token;
          if (newToken) {
            const res = await axios.get(`${API}/valuation/${sym}`, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
            setResult(res.data);
            setTicker(sym);
            const wl = lsGet("ve_watchlist", []);
            if (!wl.includes(sym)) {
              const updated = [sym, ...wl].slice(0, 8);
              lsSet("ve_watchlist", updated);
              setWatchlist(updated);
            }
          } else {
            // Session fully expired — force re-login
            await signOut();
            setAuthMode("login");
            setShowAuth(true);
            setError("Your session expired. Please log in again.");
          }
        } catch {
          await signOut();
          setAuthMode("login");
          setShowAuth(true);
          setError("Your session expired. Please log in again.");
        }
      } else {
        setError(detail || "Failed to fetch data. Check the ticker and try again.");
      }
    } finally {
      setLoading(false);
    }
    // Record usage separately so it doesn't block the analysis
    try { await recordAnalysis(); } catch (e) { console.warn("Usage tracking failed:", e); }
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
      const token = await getToken();
      const res = await fetch(`${API}/pdf/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
      a.download = `${result.ticker}_EquityValuation.pdf`;
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
        <AnimatePresence>{showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={authMode} />}</AnimatePresence>
        <AnimatePresence>{showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} reason={upgradeReason} />}</AnimatePresence>

        <div className="lp-shell">
          {/* Minimal landing header */}
          <header className="lp-header">
            <div className="lp-header-logo">
              <div className="lp-logo-mark">
                <svg viewBox="0 0 16 16" fill="none">
                  <polyline points="1,12 5,7 9,10 15,3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="lp-logo-text">Equity Valuation</span>
            </div>
            <div className="lp-header-right">
              <button className="lp-nav-btn" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === "dark" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                )}
              </button>
              {user ? (
                <>
                  <button className="lp-nav-btn" onClick={() => { setAppMode("app"); setPage("dashboard"); }}>Dashboard</button>
                  <div className="lp-user-menu">
                    <span className="lp-user-email">{user.email?.split("@")[0]}</span>
                    <span className={`lp-user-plan lp-user-plan--${profile?.plan || "free"}`}>{profile?.planLabel || "Free"}</span>
                  </div>
                </>
              ) : (
                <>
                  <button className="lp-nav-btn" onClick={() => { setAuthMode("login"); setShowAuth(true); }}>Log In</button>
                  <button className="lp-nav-cta" onClick={() => { setAuthMode("signup"); setShowAuth(true); }}>Sign Up Free</button>
                </>
              )}
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
            <p>For informational purposes only. Not financial advice. Equity Valuation does not constitute investment advice or a solicitation to buy or sell any security.</p>
          </footer>
        </div>
      </>
    );
  }

  // ── App shell (with sidebar) ───────────────────────────────────────────────
  return (
    <>
      {disclaimer && <DisclaimerModal onAccept={() => { setDisclaimer(false); lsSet("ve_disclaimer", "1"); }} />}
      <AnimatePresence>{showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={authMode} />}</AnimatePresence>
      <AnimatePresence>{showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} reason={upgradeReason} />}</AnimatePresence>

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
                  <span className="topbar-breadcrumb-home" onClick={() => setAppMode("landing")}>Equity Valuation</span>
                  <span className="topbar-breadcrumb-sep">/</span>
                  <span className="topbar-breadcrumb-current">
                    {{ dashboard: "Dashboard", screener: "Screener", compare: "Compare" }[page] || page}
                  </span>
                </div>
              )}
            </div>
            <div className="topbar-right">
              {result && page === "analysis" && isFeatureUnlocked("pdf_export") && (
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
              {user ? (
                <div className="topbar-user">
                  <span className="topbar-user-usage mono">
                    {profile?.limit === Infinity ? "∞" : `${profile?.analyses_today || 0}/${profile?.limit || 1}`}
                  </span>
                  <span className={`topbar-user-plan topbar-user-plan--${profile?.plan || "free"}`}>{profile?.planLabel || "Free"}</span>
                  <button className="topbar-user-btn" onClick={signOut} title="Sign out" aria-label="Sign out">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <button className="topbar-login-btn" onClick={() => { setAuthMode("login"); setShowAuth(true); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  Sign In
                </button>
              )}
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
                      isFeatureUnlocked={isFeatureUnlocked}
                      onUpgrade={() => { setUpgradeReason("feature"); setShowUpgrade(true); }}
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
                  {isFeatureUnlocked("compare") ? (
                    <ComparePage onSearch={handleSearch} />
                  ) : (
                    <div style={{ padding: "60px 20px", maxWidth: 500, margin: "0 auto" }}>
                      <LockedFeatureCard title="Compare Stocks" plan="Pro" onUpgrade={() => { setUpgradeReason("feature"); setShowUpgrade(true); }} />
                    </div>
                  )}
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
          <span className="disclaimer-logo-text">Equity Valuation</span>
        </div>
        <h2 className="disclaimer-title">Important Legal Notice</h2>
        <div className="disclaimer-body">
          <p><strong>Equity Valuation is not a registered financial adviser, broker, or investment firm.</strong> This platform is an independent analytical tool built for educational and research purposes only.</p>
          <p>Nothing on this platform constitutes financial advice, investment recommendations, or an offer of any kind. All intrinsic value estimates are illustrative only.</p>
          <p><strong>You should not make any investment decision based solely or partly on information provided by this tool.</strong> Always consult a qualified financial adviser.</p>
        </div>
        <button className="disclaimer-btn" onClick={onAccept}>
          I understand — Continue to Equity Valuation
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

function AnalysisResults({ result, applicable, notApplicable, unusedModels, onMemoGenerated, onMcStats, onLboStats, isFeatureUnlocked, onUpgrade }) {
  const stagger = { visible: { transition: { staggerChildren: 0.06 } } };
  const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" } } };
  const unlocked = isFeatureUnlocked || (() => true);

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

      <motion.div variants={fadeUp}>
        {unlocked("monte_carlo") ? (
          <MonteCarlo data={result} onStatsGenerated={onMcStats} />
        ) : (
          <LockedFeatureCard title="Monte Carlo Simulation" plan="Pro" onUpgrade={onUpgrade} />
        )}
      </motion.div>

      <motion.div variants={fadeUp}>
        {unlocked("lbo") ? (
          <LBOModel data={result} onResultGenerated={onLboStats} />
        ) : (
          <LockedFeatureCard title="LBO Model" plan="Pro" onUpgrade={onUpgrade} />
        )}
      </motion.div>

      <motion.div variants={fadeUp}><CompsTable ticker={result.ticker} /></motion.div>

      <motion.div variants={fadeUp}>
        {unlocked("ai_thesis") ? (
          <InvestmentThesis data={result} onMemoGenerated={onMemoGenerated} />
        ) : (
          <LockedFeatureCard title="AI Investment Thesis" plan="Pro" onUpgrade={onUpgrade} />
        )}
      </motion.div>

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
  const [slots, setSlots] = useState(["", "", "", ""]);
  const [inputs, setInputs] = useState(["", "", "", ""]);
  const [data, setData] = useState([null, null, null, null]);
  const [loadingSlot, setLoadingSlot] = useState([false, false, false, false]);
  const [errors, setErrors] = useState(["", "", "", ""]);

  const fetchStock = async (ticker, idx) => {
    if (!ticker.trim()) return;
    const sym = ticker.trim().toUpperCase();
    setLoadingSlot(prev => { const n = [...prev]; n[idx] = true; return n; });
    setErrors(prev => { const n = [...prev]; n[idx] = ""; return n; });
    try {
      const res = await axios.get(`${API}/valuation/${sym}`);
      setData(prev => { const n = [...prev]; n[idx] = res.data; return n; });
      setSlots(prev => { const n = [...prev]; n[idx] = sym; return n; });
    } catch (err) {
      setErrors(prev => { const n = [...prev]; n[idx] = err.response?.data?.detail || "Not found"; return n; });
      setData(prev => { const n = [...prev]; n[idx] = null; return n; });
    } finally {
      setLoadingSlot(prev => { const n = [...prev]; n[idx] = false; return n; });
    }
  };

  const removeStock = (idx) => {
    setSlots(prev => { const n = [...prev]; n[idx] = ""; return n; });
    setInputs(prev => { const n = [...prev]; n[idx] = ""; return n; });
    setData(prev => { const n = [...prev]; n[idx] = null; return n; });
    setErrors(prev => { const n = [...prev]; n[idx] = ""; return n; });
  };

  const loaded = data.filter(Boolean);
  const fmtNum = v => v != null ? Number(v).toFixed(2) : "—";
  const fmtPct = v => v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—";
  const fmtMktCap = v => v != null && v >= 1e12 ? `$${(v/1e12).toFixed(2)}T` : v != null && v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v != null ? `$${(v/1e6).toFixed(0)}M` : "—";

  const VERDICT_COLORS = {
    "Undervalued": "var(--green2)",
    "Overvalued": "var(--red2)",
    "Fairly Valued": "var(--yellow2)",
  };

  const METRICS = [
    { label: "P/E Ratio",    get: d => fmtNum(d.key_metrics?.pe_ratio) },
    { label: "P/B Ratio",    get: d => fmtNum(d.key_metrics?.pb_ratio) },
    { label: "EV/EBITDA",    get: d => fmtNum(d.key_metrics?.ev_ebitda) },
    { label: "P/S Ratio",    get: d => fmtNum(d.key_metrics?.ps_ratio) },
    { label: "ROE",           get: d => fmtPct(d.key_metrics?.roe),          color: d => d.key_metrics?.roe > 0.15 ? "var(--green2)" : d.key_metrics?.roe < 0 ? "var(--red2)" : null },
    { label: "Net Margin",    get: d => fmtPct(d.key_metrics?.profit_margin), color: d => d.key_metrics?.profit_margin > 0.1 ? "var(--green2)" : d.key_metrics?.profit_margin < 0 ? "var(--red2)" : null },
    { label: "Rev. Growth",   get: d => fmtPct(d.key_metrics?.revenue_growth), color: d => d.key_metrics?.revenue_growth > 0.05 ? "var(--green2)" : d.key_metrics?.revenue_growth < 0 ? "var(--red2)" : null },
    { label: "Div. Yield",    get: d => fmtPct(d.key_metrics?.dividend_yield) },
    { label: "EPS",           get: d => d.key_metrics?.eps != null ? `$${fmtNum(d.key_metrics.eps)}` : "—" },
    { label: "Beta",          get: d => fmtNum(d.key_metrics?.beta) },
  ];

  // For visual comparison bars
  const BAR_METRICS = [
    { label: "P/E Ratio",  get: d => d.key_metrics?.pe_ratio,       fmt: v => fmtNum(v), lower_better: true },
    { label: "ROE",         get: d => d.key_metrics?.roe ? d.key_metrics.roe * 100 : null, fmt: v => `${v?.toFixed(1)}%` },
    { label: "Upside",      get: d => d.consensus?.upside_pct,      fmt: v => `${v > 0 ? "+" : ""}${v?.toFixed(1)}%` },
    { label: "Net Margin",  get: d => d.key_metrics?.profit_margin ? d.key_metrics.profit_margin * 100 : null, fmt: v => `${v?.toFixed(1)}%` },
  ];

  const SLOT_COLORS = ["var(--primary2)", "var(--green2)", "var(--yellow2)", "var(--indigo2)"];
  const SLOT_BG = ["rgba(59,130,246,0.12)", "rgba(16,185,129,0.12)", "rgba(245,158,11,0.12)", "rgba(129,140,248,0.12)"];

  return (
    <div className="cmp-wrap">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="cmp-header">
          <div>
            <h1 className="cmp-title">Compare Stocks</h1>
            <p className="cmp-sub">Side-by-side comparison of up to 4 S&amp;P 500 stocks</p>
          </div>
        </div>

        {/* Input slots */}
        <div className="cmp-inputs">
          {slots.map((sym, idx) => (
            <div key={idx} className="cmp-slot">
              <div className="cmp-slot-dot" style={{ background: SLOT_COLORS[idx] }} />
              {sym ? (
                <div className="cmp-slot-filled">
                  <span className="cmp-slot-ticker mono">{sym}</span>
                  <button className="cmp-slot-remove" onClick={() => removeStock(idx)} aria-label={`Remove ${sym}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="cmp-slot-input-row">
                  <input
                    className="cmp-slot-input"
                    type="text"
                    placeholder={`Stock ${idx + 1}`}
                    value={inputs[idx]}
                    onChange={e => setInputs(prev => { const n = [...prev]; n[idx] = e.target.value.toUpperCase(); return n; })}
                    onKeyDown={e => { if (e.key === "Enter") fetchStock(inputs[idx], idx); }}
                    spellCheck={false}
                  />
                  <button
                    className="cmp-slot-add"
                    onClick={() => fetchStock(inputs[idx], idx)}
                    disabled={loadingSlot[idx] || !inputs[idx].trim()}
                  >
                    {loadingSlot[idx] ? <span className="cmp-spinner" /> : "+"}
                  </button>
                </div>
              )}
              {errors[idx] && <span className="cmp-slot-error">{errors[idx]}</span>}
            </div>
          ))}
        </div>

        {/* Quick picks */}
        {loaded.length === 0 && (
          <div className="cmp-quickpicks">
            <span className="cmp-quickpicks-label">Quick compare:</span>
            {[["AAPL", "MSFT"], ["NVDA", "AMD"], ["KO", "PEP"], ["JPM", "GS"]].map((pair, i) => (
              <button key={i} className="cmp-quickpick-btn" onClick={() => {
                setInputs(prev => { const n = [...prev]; n[0] = pair[0]; n[1] = pair[1]; return n; });
                fetchStock(pair[0], 0);
                fetchStock(pair[1], 1);
              }}>
                <span className="mono">{pair[0]}</span> vs <span className="mono">{pair[1]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {loaded.length >= 2 && (
          <motion.div className="cmp-results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Company header row */}
            <div className="cmp-table-wrap">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th className="cmp-label-col"></th>
                    {data.map((d, i) => d && (
                      <th key={i} className="cmp-stock-col">
                        <div className="cmp-stock-header">
                          <span className="cmp-stock-ticker mono" style={{ color: SLOT_COLORS[i] }}>{d.ticker}</span>
                          <span className="cmp-stock-name">{d.company_name}</span>
                          <span className="cmp-stock-sector">{d.sector}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Price & Market Cap */}
                  <tr className="cmp-row cmp-row--highlight">
                    <td className="cmp-label">Price</td>
                    {data.map((d, i) => d && (
                      <td key={i} className="cmp-val mono">${d.current_price?.toFixed(2)}</td>
                    ))}
                  </tr>
                  <tr className="cmp-row">
                    <td className="cmp-label">Market Cap</td>
                    {data.map((d, i) => d && (
                      <td key={i} className="cmp-val mono">{fmtMktCap(d.market_cap)}</td>
                    ))}
                  </tr>

                  {/* Verdict */}
                  <tr className="cmp-row cmp-row--verdict">
                    <td className="cmp-label">Verdict</td>
                    {data.map((d, i) => d && (
                      <td key={i} className="cmp-val">
                        {d.consensus ? (
                          <span className="cmp-verdict-badge" style={{ color: VERDICT_COLORS[d.consensus.overall_verdict] || "var(--text2)" }}>
                            {d.consensus.overall_verdict}
                          </span>
                        ) : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="cmp-row">
                    <td className="cmp-label">Intrinsic Value</td>
                    {data.map((d, i) => d && (
                      <td key={i} className="cmp-val mono">
                        {d.consensus ? `$${Number(d.consensus.average_intrinsic_value).toFixed(2)}` : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="cmp-row">
                    <td className="cmp-label">Upside</td>
                    {data.map((d, i) => d && (
                      <td key={i} className="cmp-val mono" style={{ color: d.consensus?.upside_pct > 0 ? "var(--green2)" : d.consensus?.upside_pct < 0 ? "var(--red2)" : "var(--text)" }}>
                        {d.consensus ? `${d.consensus.upside_pct > 0 ? "+" : ""}${Number(d.consensus.upside_pct).toFixed(1)}%` : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="cmp-row">
                    <td className="cmp-label">Models Used</td>
                    {data.map((d, i) => d && (
                      <td key={i} className="cmp-val mono">{d.consensus?.models_used || 0}</td>
                    ))}
                  </tr>

                  {/* Separator */}
                  <tr className="cmp-separator"><td colSpan={loaded.length + 1}><div className="cmp-sep-line" /></td></tr>

                  {/* Key Metrics */}
                  {METRICS.map((m, mi) => (
                    <tr key={mi} className="cmp-row">
                      <td className="cmp-label">{m.label}</td>
                      {data.map((d, i) => d && (
                        <td key={i} className="cmp-val mono" style={{ color: m.color?.(d) || "var(--text)" }}>
                          {m.get(d)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Visual comparison bars */}
            <div className="cmp-bars-section">
              <h3 className="cmp-bars-title">Visual Comparison</h3>
              {BAR_METRICS.map((bm, bi) => {
                const vals = data.map(d => d ? bm.get(d) : null);
                const validVals = vals.filter(v => v != null && isFinite(v));
                if (validVals.length < 2) return null;
                const maxAbs = Math.max(...validVals.map(Math.abs), 0.01);
                return (
                  <div key={bi} className="cmp-bar-group">
                    <div className="cmp-bar-label">{bm.label}</div>
                    <div className="cmp-bar-rows">
                      {data.map((d, i) => {
                        if (!d) return null;
                        const v = vals[i];
                        if (v == null) return null;
                        const pct = Math.min(Math.abs(v) / maxAbs * 100, 100);
                        return (
                          <div key={i} className="cmp-bar-row">
                            <span className="cmp-bar-ticker mono" style={{ color: SLOT_COLORS[i] }}>{d.ticker}</span>
                            <div className="cmp-bar-track">
                              <motion.div
                                className="cmp-bar-fill"
                                style={{ background: SLOT_COLORS[i] }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, delay: bi * 0.1, ease: "easeOut" }}
                              />
                            </div>
                            <span className="cmp-bar-val mono">{bm.fmt(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {loaded.length === 1 && (
          <div className="cmp-hint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Add at least one more stock to compare
          </div>
        )}

      </motion.div>

      <style>{`
        .cmp-wrap { max-width: 1100px; }
        .cmp-header { margin-bottom: 28px; }
        .cmp-title { font-size: 1.6rem; font-weight: 700; color: var(--text); letter-spacing: -0.8px; margin-bottom: 4px; }
        .cmp-sub { font-size: 0.85rem; color: var(--text2); }

        .cmp-inputs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .cmp-slot {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          position: relative;
        }
        .cmp-slot-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .cmp-slot-filled {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .cmp-slot-ticker { font-size: 0.92rem; font-weight: 700; color: var(--text); }
        .cmp-slot-remove {
          background: transparent;
          border: none;
          color: var(--text3);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s, background 0.2s;
        }
        .cmp-slot-remove:hover { color: var(--red2); background: var(--red-glow); }
        .cmp-slot-input-row { flex: 1; display: flex; gap: 6px; }
        .cmp-slot-input {
          flex: 1;
          background: var(--surface2);
          border: 1px solid var(--border2);
          color: var(--text);
          padding: 6px 10px;
          border-radius: 6px;
          font-family: "JetBrains Mono", monospace;
          font-size: 0.82rem;
          outline: none;
          min-width: 0;
          transition: border-color 0.2s;
        }
        .cmp-slot-input:focus { border-color: var(--primary); }
        .cmp-slot-input::placeholder { color: var(--text3); font-family: "DM Sans", sans-serif; }
        .cmp-slot-add {
          width: 32px; height: 32px;
          background: var(--primary);
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
          flex-shrink: 0;
        }
        .cmp-slot-add:disabled { opacity: 0.4; cursor: not-allowed; }
        .cmp-slot-add:hover:not(:disabled) { opacity: 0.85; }
        .cmp-slot-error {
          width: 100%;
          font-size: 0.7rem;
          color: var(--red2);
          margin-top: 2px;
        }
        .cmp-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .cmp-quickpicks {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 32px;
        }
        .cmp-quickpicks-label { font-size: 0.75rem; color: var(--text3); }
        .cmp-quickpick-btn {
          background: transparent;
          border: 1px solid var(--border2);
          color: var(--text2);
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.78rem;
          font-family: inherit;
          transition: all 0.2s;
        }
        .cmp-quickpick-btn .mono { font-weight: 700; color: var(--text); }
        .cmp-quickpick-btn:hover { border-color: var(--primary); color: var(--primary2); background: var(--surface2); }

        .cmp-results { display: flex; flex-direction: column; gap: 24px; }

        .cmp-table-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .cmp-table { width: 100%; border-collapse: collapse; }
        .cmp-label-col { width: 140px; }
        .cmp-stock-col { text-align: center; }
        .cmp-stock-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 18px 14px 14px;
        }
        .cmp-stock-ticker { font-size: 1rem; font-weight: 700; }
        .cmp-stock-name {
          font-size: 0.75rem;
          color: var(--text2);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }
        .cmp-stock-sector { font-size: 0.65rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; }

        .cmp-row td { padding: 10px 14px; border-top: 1px solid var(--border); }
        .cmp-row--highlight td { background: var(--surface2); }
        .cmp-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text3);
          white-space: nowrap;
        }
        .cmp-val {
          text-align: center;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text);
        }
        .cmp-verdict-badge { font-weight: 700; font-size: 0.82rem; }

        .cmp-separator td { padding: 0; }
        .cmp-sep-line {
          height: 3px;
          background: linear-gradient(90deg, transparent, var(--border2), transparent);
          margin: 4px 0;
        }

        .cmp-bars-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
        }
        .cmp-bars-title {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--text3);
          margin-bottom: 20px;
        }
        .cmp-bar-group { margin-bottom: 20px; }
        .cmp-bar-group:last-child { margin-bottom: 0; }
        .cmp-bar-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text2);
          margin-bottom: 8px;
        }
        .cmp-bar-rows { display: flex; flex-direction: column; gap: 6px; }
        .cmp-bar-row { display: flex; align-items: center; gap: 10px; }
        .cmp-bar-ticker { font-size: 0.72rem; font-weight: 700; width: 48px; flex-shrink: 0; }
        .cmp-bar-track {
          flex: 1;
          height: 20px;
          background: var(--surface2);
          border-radius: 4px;
          overflow: hidden;
        }
        .cmp-bar-fill {
          height: 100%;
          border-radius: 4px;
          min-width: 2px;
        }
        .cmp-bar-val { font-size: 0.75rem; font-weight: 600; color: var(--text2); width: 64px; text-align: right; flex-shrink: 0; }

        .cmp-hint {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 14px 18px;
          font-size: 0.82rem;
          color: var(--text3);
        }

        @media (max-width: 768px) {
          .cmp-inputs { grid-template-columns: 1fr 1fr; }
          .cmp-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .cmp-table { min-width: 500px; }
        }
        @media (max-width: 480px) {
          .cmp-inputs { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import MobileNav from "../components/MobileNav";
import SearchBar from "../components/SearchBar";
import AuthModal from "../components/AuthModal";
import UpgradeModal from "../components/UpgradeModal";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, isFeatureUnlocked } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("limit");
  const [theme, setTheme] = useState("dark");

  // Determine active page from pathname
  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentPage = pathParts[0] || "dashboard";

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.body.classList.toggle("light", next === "light");
  };

  const handlePageChange = (p) => {
    if (p === "dashboard") navigate("/dashboard");
    else if (p === "screener") navigate("/screener");
    else if (p === "compare") navigate("/compare");
    else if (p === "analysis") navigate("/analysis");
    else if (p === "portfolio") navigate("/portfolio");
  };

  return (
    <>
      <AnimatePresence>{showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={authMode} />}</AnimatePresence>
      <AnimatePresence>{showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} reason={upgradeReason} />}</AnimatePresence>

      <div className="app-shell">
        <Sidebar
          page={currentPage}
          setPage={handlePageChange}
          onBackToLanding={() => navigate("/")}
          onCollapseChange={setSidebarCollapsed}
        />

        <div className={`app-body${sidebarCollapsed ? " app-body--collapsed" : ""}`}>
          <header className="app-topbar">
            <div className="topbar-left">
              <div className="topbar-breadcrumb">
                <span className="topbar-breadcrumb-home" onClick={() => navigate("/")}>Equity Valuation</span>
                <span className="topbar-breadcrumb-sep">/</span>
                <span className="topbar-breadcrumb-current">
                  {{ dashboard: "Dashboard", screener: "Screener", compare: "Compare", company: "Company", analysis: "Analysis", portfolio: "Portfolio" }[currentPage] || currentPage}
                </span>
              </div>
            </div>
            <div className="topbar-right">
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

          <MobileNav page={currentPage} setPage={handlePageChange} />

          <main className="app-content">
            <Outlet context={{ showAuth: setShowAuth, setAuthMode, showUpgrade: setShowUpgrade, setUpgradeReason }} />
          </main>

          <footer style={{
            padding: "16px 24px", fontSize: 11, color: "var(--text-muted)",
            borderTop: "1px solid var(--border)", textAlign: "center", lineHeight: 1.5,
          }}>
            Equity Value is an educational tool. Nothing on this site constitutes investment advice.
            Valuations are model estimates, not guarantees. Past accuracy does not predict future results.
            Always do your own research and consult a licensed financial advisor.
          </footer>
        </div>
      </div>
    </>
  );
}

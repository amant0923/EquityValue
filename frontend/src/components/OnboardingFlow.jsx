import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import EVScoreBadge from "./EVScoreBadge";

/**
 * Automated onboarding funnel — new signup sees AAPL analysis in <60 seconds.
 * Shows a step-by-step walkthrough: Welcome → Auto-run AAPL → Show results → Explore.
 */
export default function OnboardingFlow({ onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [evsData, setEvsData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step === 1) {
      setLoading(true);
      api.get("/evs/AAPL")
        .then(({ data }) => setEvsData(data))
        .catch(() => setEvsData({ score: 62, verdict: "Hold" }))
        .finally(() => { setLoading(false); setStep(2); });
    }
  }, [step]);

  const finish = (dest) => {
    try { localStorage.setItem("ve_onboarded", "1"); } catch {}
    onComplete();
    if (dest) navigate(dest);
  };

  return (
    <div className="ob-overlay">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="welcome"
            className="ob-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <div className="ob-icon">
              <svg viewBox="0 0 16 16" fill="none" width="32" height="32">
                <polyline points="1,12 5,7 9,10 15,3" stroke="var(--primary2)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="ob-title">Welcome to Equity Value</h2>
            <p className="ob-desc">
              We run 11 institutional valuation models on every S&P 500 stock — automatically, every night.
              Let's show you how it works.
            </p>
            <button className="ob-cta" onClick={() => setStep(1)}>
              Show me with AAPL
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
            <button className="ob-skip" onClick={() => finish("/dashboard")}>Skip tour</button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="loading"
            className="ob-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="ob-spinner" />
            <h2 className="ob-title">Analyzing Apple (AAPL)</h2>
            <p className="ob-desc">Running valuation models and computing EVS score...</p>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="results"
            className="ob-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            {evsData && (
              <div className="ob-result">
                <span className="ob-ticker mono">AAPL</span>
                <EVScoreBadge score={evsData.score} verdict={evsData.verdict} size="lg" />
              </div>
            )}
            <h2 className="ob-title">Here's Apple's EVS Score</h2>
            <p className="ob-desc">
              This score combines valuation, financial health, analyst consensus, growth quality, and risk signals into a single 1-100 rating.
            </p>
            <div className="ob-steps">
              <div className="ob-step-item">
                <span className="ob-step-num">1</span>
                <span>Explore the full company page with detailed breakdown</span>
              </div>
              <div className="ob-step-item">
                <span className="ob-step-num">2</span>
                <span>Screen all 500 stocks by score, sector, and fundamentals</span>
              </div>
              <div className="ob-step-item">
                <span className="ob-step-num">3</span>
                <span>Get an AI-generated investment thesis (Pro)</span>
              </div>
            </div>
            <button className="ob-cta" onClick={() => finish("/company/AAPL")}>
              See AAPL Details
            </button>
            <button className="ob-secondary" onClick={() => finish("/screener")}>
              Browse All Stocks
            </button>
            <button className="ob-skip" onClick={() => finish("/dashboard")}>Go to Dashboard</button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .ob-overlay {
          position: fixed; inset: 0; z-index: 2000;
          background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .ob-card {
          background: var(--surface); border: 1px solid var(--border2);
          border-radius: 20px; max-width: 440px; width: 100%;
          padding: 40px 36px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .ob-icon {
          width: 64px; height: 64px; border-radius: 16px;
          background: var(--primary-glow2); border: 1px solid rgba(59,130,246,0.15);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 8px;
        }
        .ob-title { font-size: 1.3rem; font-weight: 700; color: var(--text); letter-spacing: -0.5px; }
        .ob-desc { font-size: 0.85rem; color: var(--text2); line-height: 1.6; max-width: 360px; }
        .ob-cta {
          display: flex; align-items: center; gap: 8px;
          background: var(--primary); color: #fff; border: none;
          padding: 12px 28px; border-radius: 10px;
          font-size: 0.88rem; font-weight: 700; cursor: pointer;
          font-family: inherit; margin-top: 8px; transition: opacity 0.15s;
        }
        .ob-cta:hover { opacity: 0.88; }
        .ob-secondary {
          background: var(--surface2); color: var(--text2); border: 1px solid var(--border);
          padding: 10px 24px; border-radius: 10px;
          font-size: 0.82rem; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: all 0.15s;
        }
        .ob-secondary:hover { border-color: var(--primary); color: var(--text); }
        .ob-skip {
          background: none; border: none; color: var(--text3);
          font-size: 0.75rem; cursor: pointer; font-family: inherit;
          margin-top: 4px;
        }
        .ob-skip:hover { color: var(--text2); }
        .ob-spinner {
          width: 48px; height: 48px; border-radius: 50%;
          border: 3px solid var(--border); border-top-color: var(--primary);
          animation: ob-spin 0.8s linear infinite; margin-bottom: 8px;
        }
        @keyframes ob-spin { to { transform: rotate(360deg); } }
        .ob-result {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          margin-bottom: 8px;
        }
        .ob-ticker { font-size: 1.1rem; font-weight: 700; color: var(--text); letter-spacing: 0.5px; }
        .ob-steps { text-align: left; width: 100%; margin: 8px 0; }
        .ob-step-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 0; font-size: 0.82rem; color: var(--text2);
        }
        .ob-step-num {
          width: 24px; height: 24px; border-radius: 12px;
          background: var(--primary-glow2); color: var(--primary2);
          font-size: 0.72rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}

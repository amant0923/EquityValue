import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

import CompanyNav from "../components/company/CompanyNav";
import ConsensusCard from "../components/ConsensusCard";
import ValuationCard from "../components/ValuationCard";
import ValuationChart from "../components/ValuationChart";
import FootballField from "../components/FootballField";
import SensitivityTable from "../components/SensitivityTable";
import MonteCarlo from "../components/MonteCarlo";
import LBOModel from "../components/LBOModel";
import InvestmentThesis from "../components/InvestmentThesis";
import LockedFeatureCard from "../components/LockedFeatureCard";
import PriceChart from "../components/PriceChart";
import ReverseDCF from "../components/ReverseDCF";
import SkeletonLoader from "../components/SkeletonLoader";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function CompanyValuationPage() {
  const { ticker } = useParams();
  const { isFeatureUnlocked, getLimit } = useAuth();

  const [valuation, setValuation] = useState(null);
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State for child component callbacks
  const [memoText, setMemoText] = useState("");
  const [mcStats, setMcStats] = useState(null);
  const [lboStats, setLboStats] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [valRes, scoresRes] = await Promise.allSettled([
          api.get(`/valuation/${ticker}`),
          api.get(`/scores/${ticker}`),
        ]);
        if (valRes.status === "fulfilled") {
          setValuation(valRes.value.data);
        } else {
          setError(valRes.reason?.response?.data?.detail || "Failed to load valuation data.");
          return;
        }
        if (scoresRes.status === "fulfilled") {
          setScores(scoresRes.value.data);
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load data.");
      } finally {
        setLoading(false);
      }
    }
    if (ticker) load();
  }, [ticker]);

  const allApplicable = valuation?.valuations?.filter(v => v?.applicable) || [];
  const notApplicable = valuation?.valuations?.filter(v => v && !v.applicable) || [];
  const modelsLimit = getLimit("valuation_models_limit");
  const applicable = allApplicable.slice(0, modelsLimit);
  const hiddenCount = allApplicable.length - applicable.length;

  const exportPDF = async () => {
    try {
      const res = await api.post(
        "/pdf/export",
        { data: valuation, memo: memoText || "", monte_carlo: mcStats || null, lbo: lboStats || null },
        { responseType: "blob" }
      );
      // Check if response is actually an error (JSON) disguised as blob
      if (res.data.type && res.data.type.includes("json")) {
        const text = await res.data.text();
        const err = JSON.parse(text);
        alert("PDF export failed: " + (err.detail || "Unknown error"));
        return;
      }
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${valuation.ticker || ticker}_EquityValuation.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      // Try to extract error message from blob response
      let msg = e.message;
      if (e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const err = JSON.parse(text);
          msg = err.detail || msg;
        } catch {}
      }
      alert("PDF export failed: " + msg);
    }
  };

  const handleUpgrade = () => {
    // Navigate or show upgrade modal — left as a no-op for external wiring
  };

  if (loading) {
    return (
      <div className="cvp-wrap">
        <CompanyNav />
        <SkeletonLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cvp-wrap">
        <CompanyNav />
        <div className="error-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      </div>
    );
  }

  if (!valuation) return null;

  const fmtPrice = (v) => {
    if (v == null || isNaN(v)) return "N/A";
    return `$${Number(v).toFixed(2)}`;
  };

  return (
    <div className="cvp-wrap">
      <CompanyNav />

      <motion.div initial="hidden" animate="visible" variants={stagger} className="cvp-content">

        {/* 1. Consensus Card */}
        {valuation.consensus && (
          <motion.div variants={fadeUp}>
            <ConsensusCard data={valuation.consensus} signals={valuation.signals} />
          </motion.div>
        )}

        {/* 2. ValuationChart + FootballField (always show all models in charts) */}
        {allApplicable.length > 0 && (
          <motion.div variants={fadeUp} className="cvp-charts-row">
            <div className="cvp-chart-half">
              <ValuationChart valuations={allApplicable} currentPrice={valuation.current_price} />
            </div>
            <div className="cvp-chart-half">
              <FootballField valuations={allApplicable} currentPrice={valuation.current_price} consensus={valuation.consensus} />
            </div>
          </motion.div>
        )}

        {/* 3. PriceChart */}
        <motion.div variants={fadeUp}>
          <PriceChart ticker={ticker} currentPrice={valuation.current_price} />
        </motion.div>

        {/* 4. Model Results grid */}
        {applicable.length > 0 && (
          <motion.section variants={fadeUp}>
            <div className="cvp-section-header">
              <h2 className="section-title">Model Results</h2>
              <span className="results-count">{applicable.length} models applied</span>
            </div>
            <div className="cards-grid">
              {applicable.map((v, i) => (
                <ValuationCard key={i} data={v} />
              ))}
            </div>
            {hiddenCount > 0 && (
              <div className="cvp-models-locked">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                {hiddenCount} more model{hiddenCount > 1 ? "s" : ""} available on Pro
              </div>
            )}
          </motion.section>
        )}

        {/* 5. Reverse DCF */}
        {valuation.reverse_dcf && (
          <motion.div variants={fadeUp}>
            <ReverseDCF data={valuation.reverse_dcf} />
          </motion.div>
        )}

        {/* 6. Sensitivity Table */}
        {valuation.dcf_sensitivity && (
          <motion.div variants={fadeUp}>
            <SensitivityTable data={valuation.dcf_sensitivity} currentPrice={valuation.current_price} />
          </motion.div>
        )}

        {/* 6. Monte Carlo (feature-gated) */}
        <motion.div variants={fadeUp}>
          {isFeatureUnlocked("monte_carlo") ? (
            <MonteCarlo data={valuation} onStatsGenerated={setMcStats} />
          ) : (
            <LockedFeatureCard title="Monte Carlo Simulation" plan="Pro" onUpgrade={handleUpgrade} />
          )}
        </motion.div>

        {/* 7. LBO Model (feature-gated) */}
        <motion.div variants={fadeUp}>
          {isFeatureUnlocked("lbo") ? (
            <LBOModel data={valuation} onResultGenerated={setLboStats} />
          ) : (
            <LockedFeatureCard title="LBO Model" plan="Pro" onUpgrade={handleUpgrade} />
          )}
        </motion.div>

        {/* 8. AI Investment Thesis (feature-gated) */}
        <motion.div variants={fadeUp}>
          {isFeatureUnlocked("ai_thesis") ? (
            <InvestmentThesis data={valuation} onMemoGenerated={setMemoText} />
          ) : (
            <LockedFeatureCard title="AI Investment Memo" plan="Pro" onUpgrade={handleUpgrade} />
          )}
        </motion.div>

        {/* 9. FMP DCF Comparison card */}
        {scores && (
          <motion.div variants={fadeUp}>
            <div className="cvp-fmp-card glass-card">
              <div className="cvp-fmp-header">
                <span className="cvp-fmp-title">DCF Comparison</span>
                <span className="cvp-fmp-sub">External FMP DCF vs. app consensus</span>
              </div>
              <div className="cvp-fmp-grid">
                <div className="cvp-fmp-item">
                  <span className="cvp-fmp-label">FMP DCF</span>
                  <span className="cvp-fmp-value">{fmtPrice(scores.dcf_value)}</span>
                </div>
                <div className="cvp-fmp-item">
                  <span className="cvp-fmp-label">Levered DCF</span>
                  <span className="cvp-fmp-value">{fmtPrice(scores.levered_dcf)}</span>
                </div>
                <div className="cvp-fmp-item">
                  <span className="cvp-fmp-label">Owner Earnings / Share</span>
                  <span className="cvp-fmp-value">{fmtPrice(scores.owner_earnings_per_share)}</span>
                </div>
                <div className="cvp-fmp-divider" />
                <div className="cvp-fmp-item cvp-fmp-item--highlight">
                  <span className="cvp-fmp-label">EV Model Consensus</span>
                  <span className="cvp-fmp-value">
                    {valuation.consensus?.average_intrinsic_value
                      ? fmtPrice(valuation.consensus.average_intrinsic_value)
                      : "N/A"}
                  </span>
                </div>
                <div className="cvp-fmp-item cvp-fmp-item--highlight">
                  <span className="cvp-fmp-label">Current Price</span>
                  <span className="cvp-fmp-value">{fmtPrice(valuation.current_price)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 10. Not Applicable models */}
        {notApplicable.length > 0 && (
          <motion.section variants={fadeUp}>
            <div className="cvp-section-header">
              <h2 className="section-title muted-title">Not Applicable</h2>
              <span className="results-count">{notApplicable.length} models excluded</span>
            </div>
            <div className="cvp-na-grid">
              {notApplicable.map((v, i) => (
                <div key={i} className="cvp-na-card">
                  <span className="cvp-na-name">{v.model}</span>
                  <span className="cvp-na-reason">{v.reason || "Missing required data"}</span>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* 11. PDF Export button */}
        <motion.div variants={fadeUp} className="cvp-export-row">
          {isFeatureUnlocked("pdf_export") ? (
            <button className="cvp-export-btn" onClick={exportPDF}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export PDF Report
            </button>
          ) : (
            <button className="cvp-export-btn" style={{ opacity: 0.5, cursor: "not-allowed" }} disabled title="Upgrade to Pro to export PDF reports">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              Export PDF (Pro)
            </button>
          )}
        </motion.div>

      </motion.div>

      <style>{`
        .cvp-wrap {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .cvp-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .cvp-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .cvp-charts-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .cvp-chart-half {
          min-width: 0;
        }

        /* FMP DCF Comparison */
        .cvp-fmp-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
        }
        .cvp-fmp-header {
          margin-bottom: 16px;
        }
        .cvp-fmp-title {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text2);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 4px;
        }
        .cvp-fmp-sub {
          font-size: 0.7rem;
          color: var(--text3);
        }
        .cvp-fmp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .cvp-fmp-item {
          background: var(--surface2);
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .cvp-fmp-item--highlight {
          background: var(--surface3);
        }
        .cvp-fmp-label {
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text3);
        }
        .cvp-fmp-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text);
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: -0.5px;
        }
        .cvp-fmp-divider {
          display: none;
        }

        /* Models locked banner */
        .cvp-models-locked {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 12px;
          padding: 14px 20px;
          background: var(--surface);
          border: 1px dashed var(--border2);
          border-radius: var(--radius);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text2);
        }

        /* Not Applicable grid */
        .cvp-na-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 8px;
        }
        .cvp-na-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          opacity: 0.6;
        }
        .cvp-na-name {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text2);
        }
        .cvp-na-reason {
          font-size: 0.72rem;
          color: var(--text3);
          line-height: 1.4;
        }

        /* Export button */
        .cvp-export-row {
          display: flex;
          justify-content: flex-end;
        }
        .cvp-export-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--primary);
          color: #fff;
          border: none;
          padding: 10px 22px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s;
          letter-spacing: 0.3px;
        }
        .cvp-export-btn:hover {
          opacity: 0.88;
        }

        @media (max-width: 768px) {
          .cvp-charts-row {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .cvp-na-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import api from "../lib/api";
import ModelLeaderboard from "../components/accuracy/ModelLeaderboard";
import SectorAccuracy from "../components/accuracy/SectorAccuracy";
import MethodologySection from "../components/accuracy/MethodologySection";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "EVS Accuracy Tracker — Stock Valuation Model Performance",
  description:
    "Live directional accuracy tracking for 12+ valuation models across S&P 500 stocks, updated nightly with Wilson score confidence intervals.",
  url: "https://equityvalue.ai/accuracy",
  creator: {
    "@type": "Organization",
    name: "Equity Value",
    url: "https://equityvalue.ai",
  },
  temporalCoverage: "2026-03/..",
  variableMeasured: [
    "14-day directional accuracy",
    "30-day directional accuracy",
    "6-month directional accuracy",
    "12-month directional accuracy",
    "Wilson score 95% confidence interval",
    "Sector-level accuracy breakdown",
  ],
};

function HeroStatCard({ value, label, subtitle, color }) {
  return (
    <motion.div variants={fadeUp} style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      padding: "28px 24px", flex: "1 1 0", minWidth: 240, textAlign: "center",
    }}>
      <div style={{ fontSize: "2.4rem", fontWeight: 800, color, letterSpacing: "-1.5px", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", marginTop: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--text3)", marginTop: 6, lineHeight: 1.5 }}>
        {subtitle}
      </div>
    </motion.div>
  );
}

export default function PublicAccuracyPage() {
  const [models, setModels] = useState([]);
  const [highlights, setHighlights] = useState(null);
  const [modelsData, setModelsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Stock Valuation Model Accuracy \u2014 Live Tracking | Equity Value";
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    let meta = document.querySelector('meta[name="description"]');
    const hadMeta = !!meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "The only platform publishing real-time valuation model accuracy. See which models predict stock direction best across 500+ S&P 500 stocks.";

    let canonical = document.querySelector('link[rel="canonical"]');
    const hadCanonical = !!canonical;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = "https://equityvalue.ai/accuracy";

    return () => {
      script.remove();
      if (!hadMeta && meta.parentNode) meta.remove();
      if (!hadCanonical && canonical.parentNode) canonical.remove();
    };
  }, []);

  useEffect(() => {
    Promise.all([
      api.get("/accuracy/models"),
      api.get("/accuracy/highlights"),
    ])
      .then(([modelsRes, highlightsRes]) => {
        setModels(modelsRes.data.models || []);
        setModelsData(modelsRes.data);
        setHighlights(highlightsRes.data);
      })
      .catch((err) => { if (import.meta.env.DEV) console.error("Accuracy fetch error:", err); })
      .finally(() => setLoading(false));
  }, []);

  const status = modelsData?.status || "collecting";
  const fmtNum = (n) => n != null ? n.toLocaleString() : "\u2014";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <motion.div initial="hidden" animate="visible" variants={stagger}>

        {/* Page title + LIVE BETA badge */}
        <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 12, paddingTop: 8 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <h1 style={{
              fontSize: "2rem", fontWeight: 800, color: "var(--text)",
              letterSpacing: "-1px", margin: 0, lineHeight: 1.2,
            }}>
              EVS Accuracy Tracker
            </h1>
            {status === "beta" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 10px", borderRadius: 999,
                background: "rgba(96, 165, 250, 0.12)", border: "1px solid rgba(96, 165, 250, 0.25)",
                fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.8px",
                color: "#60a5fa", textTransform: "uppercase",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#60a5fa", animation: "pulse-dot 2s ease-in-out infinite",
                }} />
                LIVE BETA
              </span>
            )}
          </div>
          <p style={{
            fontSize: "1rem", color: "var(--text2)",
            maxWidth: 560, margin: "10px auto 0", lineHeight: 1.6,
          }}>
            We publish our accuracy because we believe transparency builds trust.
          </p>
        </motion.div>

        {/* Loading */}
        {loading ? (
          <motion.div variants={fadeUp} style={{ textAlign: "center", padding: "60px 0", color: "var(--text3)" }}>
            Loading accuracy data...
          </motion.div>
        ) : (
          <>
            {/* Hero stat cards */}
            {highlights && (
              <motion.div variants={fadeUp} style={{
                display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap",
              }}>
                <HeroStatCard
                  value={highlights.undervalued_accuracy_pct != null ? `${highlights.undervalued_accuracy_pct}%` : "\u2014"}
                  label="Undervalued calls correct"
                  subtitle="When our models say a stock is cheap, it goes up 3 out of 4 times"
                  color="#22c55e"
                />
                <HeroStatCard
                  value={highlights.consensus_accuracy_pct != null ? `${highlights.consensus_accuracy_pct}%` : "\u2014"}
                  label="Consensus model accuracy"
                  subtitle="Directional accuracy across all market-based valuation models"
                  color="#60a5fa"
                />
                <HeroStatCard
                  value={fmtNum(highlights.total_snapshots)}
                  label="Valuations tracked"
                  subtitle={`Snapshots since ${highlights.data_since || "March 2026"}`}
                  color="var(--text2)"
                />
              </motion.div>
            )}

            {/* Preliminary disclaimer */}
            {highlights && (
              <motion.div variants={fadeUp} style={{
                textAlign: "center", fontSize: "0.8rem", color: "var(--text3)",
                marginBottom: 32, lineHeight: 1.5,
              }}>
                Preliminary results over {highlights.trading_days || 0} trading days ({highlights.evaluation_window_days || 0}-day window).
                {" "}6-month and 12-month accuracy tracking in progress.
              </motion.div>
            )}

            {/* Model Leaderboard */}
            <div style={{ marginBottom: 32 }}>
              <ModelLeaderboard models={models} status={status} modelsData={modelsData} />
            </div>

            {/* Sector Accuracy */}
            {modelsData?.sectors?.length > 0 && (
              <motion.div variants={fadeUp} style={{ marginBottom: 32 }}>
                <SectorAccuracy sectors={modelsData.sectors} />
              </motion.div>
            )}

            {/* Methodology */}
            <motion.div variants={fadeUp} style={{ marginBottom: 32 }}>
              <MethodologySection />
            </motion.div>

            {/* CTAs */}
            <motion.div variants={fadeUp} style={{
              display: "flex", gap: 16, marginBottom: 48, flexWrap: "wrap",
            }}>
              <Link to="/screener" style={{
                flex: "1 1 0", minWidth: 280, textDecoration: "none",
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                padding: "24px", display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "border-color 0.15s",
              }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = "#22c55e"}
                onMouseOut={(e) => e.currentTarget.style.borderColor = ""}
              >
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                    See which stocks are undervalued right now
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text3)" }}>
                    Browse the S&P 500 screener with EVS scores
                  </div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
              <Link to="/dashboard" style={{
                flex: "1 1 0", minWidth: 280, textDecoration: "none",
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                padding: "24px", display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "border-color 0.15s",
              }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = "#60a5fa"}
                onMouseOut={(e) => e.currentTarget.style.borderColor = ""}
              >
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                    Get EVS alerts when scores change
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text3)" }}>
                    Set up watchlist alerts for your portfolio
                  </div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            </motion.div>
          </>
        )}
      </motion.div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

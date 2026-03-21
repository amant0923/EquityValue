import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import api from "../lib/api";
import ModelLeaderboard from "../components/accuracy/ModelLeaderboard";
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
  name: "Equity Value Score Model Accuracy",
  description:
    "Directional accuracy tracking for 12 valuation models across S&P 500 stocks, updated nightly with Wilson score confidence intervals.",
  url: "https://equityval.com/accuracy",
  creator: {
    "@type": "Organization",
    name: "EquityVal",
  },
  temporalCoverage: "2026-03/..",
  variableMeasured: [
    "6-month directional accuracy",
    "12-month directional accuracy",
    "Wilson score 95% confidence interval",
  ],
};

export default function PublicAccuracyPage() {
  const [models, setModels] = useState([]);
  const [status, setStatus] = useState("collecting");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Model Accuracy - EquityVal";
    // Inject JSON-LD structured data
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    // Inject meta description
    let meta = document.querySelector('meta[name="description"]');
    const hadMeta = !!meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "See how our valuation models perform. Transparent accuracy tracking with confidence intervals across all S&P 500 stocks.";
    return () => {
      script.remove();
      if (!hadMeta && meta.parentNode) meta.remove();
    };
  }, []);

  useEffect(() => {
    api
      .get("/accuracy/models")
      .then((res) => {
        setModels(res.data.models || []);
        setStatus(res.data.status || "collecting");
      })
      .catch((err) => { if (import.meta.env.DEV) console.error("Accuracy fetch error:", err); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* Hero */}
        <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 48, paddingTop: 8 }}>
          <h1 style={{
            fontSize: "2rem",
            fontWeight: 800,
            color: "#e2e8f0",
            letterSpacing: "-1px",
            marginBottom: 8,
            lineHeight: 1.2,
          }}>
            Our Models. Our Track Record. Verified.
          </h1>
          <p style={{
            fontSize: "1rem",
            color: "#94a3b8",
            maxWidth: 560,
            margin: "0 auto",
            lineHeight: 1.6,
          }}>
            We publish our accuracy because we believe transparency builds trust.
          </p>
        </motion.div>

        {/* Loading state */}
        {loading ? (
          <motion.div variants={fadeUp} style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            Loading accuracy data...
          </motion.div>
        ) : (
          <>
            {/* Model Leaderboard */}
            <div style={{ marginBottom: 32 }}>
              <ModelLeaderboard models={models} status={status} />
            </div>

            {/* EVS Backtest Placeholder */}
            <motion.div variants={fadeUp} style={{
              background: "#1e293b", border: "1px solid #334155", borderRadius: 12,
              padding: "32px 24px", marginBottom: 32, textAlign: "center",
            }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>
                EVS Score Backtest
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#64748b", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
                Performance data being collected. Results will appear after 6 months of tracking.
                We will show how stocks scored 80+ vs 40- performed over subsequent periods.
              </p>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                marginTop: 16, padding: "8px 16px",
                background: "#0f172a", borderRadius: 8, fontSize: "0.8rem", color: "#60a5fa",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Estimated availability: September 2026
              </div>
            </motion.div>

            {/* Methodology */}
            <motion.div variants={fadeUp} style={{ marginBottom: 48 }}>
              <MethodologySection />
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}

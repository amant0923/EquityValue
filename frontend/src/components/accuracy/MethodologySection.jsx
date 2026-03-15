import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const sections = [
  {
    title: "What is EVS?",
    content:
      "The Equity Value Score (EVS) is a proprietary 1-100 composite score that synthesizes multiple valuation signals into a single, actionable metric. It is composed of five weighted components: Valuation (35%), Financial Health (20%), Analyst Alignment (15%), Growth Quality (15%), and Risk Signals (15%). A higher score indicates that our models see stronger evidence of undervaluation relative to fundamentals.",
  },
  {
    title: "Data Sources",
    content:
      "All analysis is built on institutional-grade data. Fundamentals (financial statements, key metrics, growth rates) come from Financial Modeling Prep (FMP). Live stock prices are sourced from Finnhub. Historical price data for backtesting uses yfinance with Finnhub as a fallback. Analyst ratings, insider trades, and senate disclosures are refreshed daily.",
  },
  {
    title: "How Accuracy is Measured",
    content:
      "Every night, we snapshot each valuation model's intrinsic value estimate alongside the current stock price. If a model's intrinsic value is above the market price, it predicts the stock will go UP; if below, it predicts DOWN. After 6 and 12 months, we compare the predicted direction against the actual price movement. The accuracy percentage represents the proportion of correct directional calls across all snapshots.",
  },
  {
    title: "Confidence Intervals",
    content:
      "Raw accuracy percentages can be misleading with small sample sizes. A model that is 3 for 3 is not necessarily 100% accurate. We use the Wilson score interval at 95% confidence to compute a range that accounts for sample size uncertainty. The interval shown (e.g., 65.2-79.1%) means we are 95% confident the true accuracy falls within that range.",
  },
  {
    title: "Sufficient Sample Size",
    content:
      'Models with fewer than 20 directional snapshots are displayed as "Collecting data..." rather than showing a potentially misleading accuracy rate. This threshold ensures that reported percentages have enough statistical weight to be meaningful. As our tracking history grows, more models will cross this threshold and display accuracy figures.',
  },
];

export default function MethodologySection() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div style={{
      background: "#1e293b", border: "1px solid #334155", borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #334155" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
          Methodology
        </h2>
        <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "4px 0 0" }}>
          How we measure and report model accuracy
        </p>
      </div>

      {sections.map((s, i) => (
        <div key={i} style={{ borderBottom: i < sections.length - 1 ? "1px solid #334155" : "none" }}>
          <button
            onClick={() => toggle(i)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#e2e8f0",
              fontSize: "0.9rem",
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            <span>{s.title}</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{
                transform: openIndex === i ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
                flexShrink: 0,
                marginLeft: 12,
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <AnimatePresence>
            {openIndex === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{
                  padding: "0 20px 16px",
                  fontSize: "0.84rem",
                  color: "#94a3b8",
                  lineHeight: 1.65,
                }}>
                  {s.content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

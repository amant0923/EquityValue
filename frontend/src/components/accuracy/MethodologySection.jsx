import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const sections = [
  {
    title: "What is EVS?",
    content:
      "The Equity Value Score (EVS) is a proprietary 1-100 composite score that synthesizes multiple valuation signals into a single, actionable metric. It is composed of five weighted components: Valuation (35%), Financial Health (20%), Analyst Alignment (15%), Growth Quality (15%), and Risk Signals (15%). A higher score indicates that our models see stronger evidence of undervaluation relative to fundamentals.",
  },
  {
    title: "What are consensus models?",
    content:
      'The EVS score is built from "consensus" models \u2014 market-based valuation approaches that compare a stock\u2019s price to its peers or cash flows: DCF, P/E, P/S, EV/EBITDA, EV/EBIT, EV/Sales, P/B, PEG, and FCF Yield. These models use real market multiples and financial projections. Outlier models (Graham Number, DDM, Capitalization of Earnings, Residual Income) use simplified assumptions like fixed growth rates or book-value-only inputs, making them poor directional predictors. They are tracked and shown for transparency but excluded from the EVS composite.',
  },
  {
    title: "How accuracy is measured",
    content:
      "Every night, we snapshot each valuation model\u2019s intrinsic value estimate alongside the current stock price. If a model\u2019s intrinsic value is above the market price, it predicts the stock will go UP; if below, it predicts DOWN. We then compare the predicted direction against the actual price movement over 14-day, 30-day, 6-month, and 12-month windows. The accuracy percentage represents the proportion of correct directional calls across all snapshots.",
  },
  {
    title: "Why short-term accuracy is inherently noisy",
    content:
      "Fundamental valuation models are designed to identify mispricing over 6-12 month horizons. A stock that is fundamentally undervalued may continue to decline in the short term due to market sentiment, macro shocks, or sector rotation. Our 14-day and 30-day accuracy metrics are preliminary signals, not definitive measures of model quality. The 6-month and 12-month metrics (available September 2026 and March 2027 respectively) will provide the most meaningful assessment of our models\u2019 predictive power.",
  },
  {
    title: "Wilson confidence intervals",
    content:
      "Raw accuracy percentages can be misleading with small sample sizes. A model that is 3 for 3 is not necessarily 100% accurate. We use the Wilson score interval at 95% confidence to compute a range that accounts for sample size uncertainty. The interval shown (e.g., 55.9% (52.1\u201359.6%)) means we are 95% confident the true accuracy falls within that range. As sample sizes grow, these intervals will narrow.",
  },
  {
    title: "Data sources",
    content:
      "All analysis is built on institutional-grade data. Fundamentals (financial statements, key metrics, growth rates) come from Financial Modeling Prep (FMP). Live stock prices are sourced from Finnhub. Historical price data for backtesting uses yfinance with Finnhub as a fallback. Analyst ratings, insider trades, and senate disclosures are refreshed daily. EVS scores are recomputed nightly for all S&P 500 constituents.",
  },
];

export default function MethodologySection() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
          Methodology
        </h2>
        <p style={{ fontSize: "0.8rem", color: "var(--text3)", margin: "4px 0 0" }}>
          How we measure and report model accuracy
        </p>
      </div>

      {sections.map((s, i) => (
        <div key={i} style={{ borderBottom: i < sections.length - 1 ? "1px solid var(--border)" : "none" }}>
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
              color: "var(--text)",
              fontSize: "0.9rem",
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            <span>{s.title}</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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
                  color: "var(--text3)",
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

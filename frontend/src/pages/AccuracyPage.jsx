import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import api from "../lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export default function AccuracyPage() {
  const [models, setModels] = useState([]);
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get("/accuracy/models"),
      api.get("/accuracy/score"),
    ]).then(([modelsRes, scoreRes]) => {
      if (modelsRes.status === "fulfilled") setModels(modelsRes.value.data);
      if (scoreRes.status === "fulfilled") setScoreData(scoreRes.value.data);
      setLoading(false);
    });
  }, []);

  const fmtPct = (v) => v != null ? `${v}%` : "—";

  return (
    <div style={{ maxWidth: 900 }}>
      <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
        <motion.div variants={fadeUp} style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.8px", marginBottom: 4 }}>
            Model Accuracy
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text2)" }}>
            Track which valuation models predict price direction most accurately
          </p>
        </motion.div>

        {/* Data collection banner */}
        <motion.div variants={fadeUp} style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Data Collection In Progress</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
              Accuracy data requires 6+ months of daily valuation snapshots. Results will appear as data accumulates.
              Initial figures are based on retrospective simulations where possible.
            </div>
          </div>
        </motion.div>

        {/* Model Leaderboard */}
        <motion.div variants={fadeUp} style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          overflow: "hidden", marginBottom: 24,
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>Model Leaderboard</h2>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text3)" }}>Loading...</div>
          ) : models.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
              No accuracy data yet. Check back after data collection begins.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface2)" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--text2)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Model</th>
                  <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 600, color: "var(--text2)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>6-Month</th>
                  <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 600, color: "var(--text2)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>12-Month</th>
                  <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 600, color: "var(--text2)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Samples</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.model} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text)" }}>{m.model}</td>
                    <td style={{
                      padding: "10px 16px", textAlign: "center", fontWeight: 700,
                      color: m.accuracy_6mo >= 60 ? "#22c55e" : m.accuracy_6mo != null ? "#eab308" : "var(--text3)",
                    }}>
                      {fmtPct(m.accuracy_6mo)}
                    </td>
                    <td style={{
                      padding: "10px 16px", textAlign: "center", fontWeight: 700,
                      color: m.accuracy_12mo >= 60 ? "#22c55e" : m.accuracy_12mo != null ? "#eab308" : "var(--text3)",
                    }}>
                      {fmtPct(m.accuracy_12mo)}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "var(--text2)" }}>
                      {m.sample_size_6mo || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>

        {/* Score accuracy */}
        {scoreData && scoreData.status === "collecting" && (
          <motion.div variants={fadeUp} style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
            padding: "20px", marginBottom: 24, textAlign: "center", color: "var(--text2)", fontSize: 13,
          }}>
            {scoreData.message}
          </motion.div>
        )}

        {/* Methodology */}
        <motion.div variants={fadeUp} style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          padding: "20px", marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>Methodology</h2>
          <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 8px" }}>
              <strong>How we track accuracy:</strong> Every trading day, we snapshot each valuation model's
              intrinsic value estimate alongside the current market price for all S&P 500 stocks.
            </p>
            <p style={{ margin: "0 0 8px" }}>
              <strong>Directional accuracy:</strong> After 6 and 12 months, we check whether the model's
              directional call was correct. If a model said a stock was undervalued (intrinsic value &gt; price)
              and the stock price subsequently rose, that's a correct prediction.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Transparency:</strong> We report the sample size alongside every accuracy figure.
              A model with 95% accuracy on 10 samples is less meaningful than one with 65% on 500 samples.
              We recommend waiting for at least 100 samples before drawing conclusions.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

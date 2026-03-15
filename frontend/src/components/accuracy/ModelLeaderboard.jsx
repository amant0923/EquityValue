import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

function accuracyColor(val) {
  if (val == null) return "#64748b";
  if (val >= 60) return "#22c55e";
  if (val >= 50) return "#eab308";
  return "#ef4444";
}

function formatAccuracy(acc, ci) {
  if (acc == null) return { text: "Collecting data...", color: "#64748b" };
  const ciText = ci ? ` (${ci[0].toFixed(1)}-${ci[1].toFixed(1)}%)` : "";
  return {
    text: `${acc.toFixed(1)}%${ciText}`,
    color: accuracyColor(acc),
  };
}

export default function ModelLeaderboard({ models, status }) {
  const sorted = [...(models || [])].sort((a, b) => {
    if (a.accuracy_6mo == null && b.accuracy_6mo == null) return 0;
    if (a.accuracy_6mo == null) return 1;
    if (b.accuracy_6mo == null) return -1;
    return b.accuracy_6mo - a.accuracy_6mo;
  });

  return (
    <motion.div variants={fadeUp}>
      {status === "collecting" && (
        <div style={{
          background: "#1e293b", border: "1px solid #334155", borderRadius: 12,
          padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Data Collection In Progress</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              Our models began tracking in March 2026. Accuracy percentages will become more reliable as sample sizes grow.
            </div>
          </div>
        </div>
      )}

      <div style={{
        background: "#1e293b", border: "1px solid #334155", borderRadius: 12,
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #334155" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
            Model Leaderboard
          </h2>
          <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "4px 0 0" }}>
            Directional accuracy across all S&P 500 stocks
          </p>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155" }}>
                <th style={thStyle}>#</th>
                <th style={{ ...thStyle, textAlign: "left" }}>Model</th>
                <th style={thStyle}>6-Month Accuracy</th>
                <th style={thStyle}>12-Month Accuracy</th>
                <th style={thStyle}>Samples</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, i) => {
                const acc6 = formatAccuracy(m.accuracy_6mo, m.ci_6mo);
                const acc12 = formatAccuracy(m.accuracy_12mo, m.ci_12mo);
                return (
                  <tr key={m.model_name} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ ...tdStyle, color: "#64748b", fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ ...tdStyle, textAlign: "left", color: "#e2e8f0", fontWeight: 500 }}>
                      {m.model_name}
                    </td>
                    <td style={{ ...tdStyle, color: acc6.color, fontWeight: 600 }}>
                      {acc6.text}
                    </td>
                    <td style={{ ...tdStyle, color: acc12.color, fontWeight: 600 }}>
                      {acc12.text}
                    </td>
                    <td style={{ ...tdStyle, color: "#94a3b8" }}>
                      {m.samples_6mo || 0}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, color: "#64748b", textAlign: "center", padding: "32px 16px" }}>
                    No model data available yet. Check back after the nightly pipeline runs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

const thStyle = {
  padding: "12px 16px",
  textAlign: "center",
  color: "#94a3b8",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle = {
  padding: "12px 16px",
  textAlign: "center",
};

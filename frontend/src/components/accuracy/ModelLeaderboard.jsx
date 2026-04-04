import { useState } from "react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const WINDOW_LABELS = {
  "14d": "14-Day",
  "30d": "30-Day",
  "6mo": "6-Month",
  "12mo": "12-Month",
};

function accuracyColor(val) {
  if (val == null) return "var(--text3)";
  if (val >= 60) return "#22c55e";
  if (val >= 55) return "#4ade80";
  if (val >= 50) return "#eab308";
  return "#94a3b8";
}

function formatAccuracy(acc, ci) {
  if (acc == null) return { text: "Collecting...", color: "var(--text3)" };
  const ciText = ci ? ` (${ci[0].toFixed(1)}\u2013${ci[1].toFixed(1)}%)` : "";
  return {
    text: `${acc.toFixed(1)}%${ciText}`,
    color: accuracyColor(acc),
  };
}

function getAvailableWindows(models) {
  const windows = [];
  for (const wkey of ["14d", "30d", "6mo", "12mo"]) {
    const hasData = models.some((m) => m[`samples_${wkey}`] > 0);
    if (hasData) windows.push(wkey);
  }
  return windows;
}

function getDefaultWindow(windows) {
  // Prefer longest available window
  for (const pref of ["6mo", "12mo", "30d", "14d"]) {
    if (windows.includes(pref)) return pref;
  }
  return windows[0] || "14d";
}

export default function ModelLeaderboard({ models, status, modelsData }) {
  const availableWindows = getAvailableWindows(models || []);
  const [activeWindow, setActiveWindow] = useState(() => getDefaultWindow(availableWindows));

  const consensus = [...(models || [])].filter((m) => m.is_consensus);
  const outliers = [...(models || [])].filter((m) => !m.is_consensus);

  const sortByWindow = (arr, wkey) =>
    [...arr].sort((a, b) => {
      const aVal = a[`accuracy_${wkey}`];
      const bVal = b[`accuracy_${wkey}`];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return bVal - aVal;
    });

  const sortedConsensus = sortByWindow(consensus, activeWindow);
  const sortedOutliers = sortByWindow(outliers, activeWindow);

  return (
    <motion.div variants={fadeUp}>
      {status === "beta" && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          padding: "14px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Short-term data only</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              Fundamental valuation models are designed for 6-12 month horizons. Short-term accuracy is inherently noisier.
              Results will become more meaningful as we accumulate longer tracking history.
            </div>
          </div>
        </div>
      )}

      {/* Consensus Models */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        overflow: "hidden", marginBottom: 16,
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
              Consensus Model Leaderboard
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text3)", margin: "4px 0 0" }}>
              These models feed the EVS composite score
            </p>
          </div>
          {availableWindows.length > 1 && (
            <div style={{ display: "flex", gap: 4 }}>
              {availableWindows.map((w) => (
                <button
                  key={w}
                  onClick={() => setActiveWindow(w)}
                  style={{
                    padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)",
                    background: activeWindow === w ? "rgba(96, 165, 250, 0.15)" : "transparent",
                    color: activeWindow === w ? "#60a5fa" : "var(--text3)",
                    fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {WINDOW_LABELS[w]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={thStyle}>#</th>
                <th style={{ ...thStyle, textAlign: "left" }}>Model</th>
                <th style={thStyle}>{WINDOW_LABELS[activeWindow]} Accuracy</th>
                <th style={thStyle}>Samples</th>
              </tr>
            </thead>
            <tbody>
              {sortedConsensus.map((m, i) => {
                const acc = formatAccuracy(m[`accuracy_${activeWindow}`], m[`ci_${activeWindow}`]);
                return (
                  <tr key={m.model_name} style={{ borderBottom: "1px solid var(--border-subtle, rgba(51,65,85,0.5))" }}>
                    <td style={{ ...tdStyle, color: "var(--text3)", fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ ...tdStyle, textAlign: "left", color: "var(--text)", fontWeight: 500 }}>
                      {m.model_name}
                    </td>
                    <td style={{ ...tdStyle, color: acc.color, fontWeight: 600 }}>
                      {acc.text}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--text3)" }}>
                      {m[`samples_${activeWindow}`] || 0}
                    </td>
                  </tr>
                );
              })}
              {sortedConsensus.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, color: "var(--text3)", textAlign: "center", padding: "32px 16px" }}>
                    No consensus model data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outlier / Excluded Models */}
      {sortedOutliers.length > 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
              Excluded from Consensus
            </h2>
            <p style={{ fontSize: "0.78rem", color: "var(--text3)", margin: "4px 0 0", lineHeight: 1.5 }}>
              These models use simplified assumptions (book value, fixed growth rates, dividend-only) that
              make them unreliable for short-term directional predictions. They are tracked for transparency
              but excluded from the EVS composite score.
            </p>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Model</th>
                  <th style={thStyle}>{WINDOW_LABELS[activeWindow]} Accuracy</th>
                  <th style={thStyle}>Samples</th>
                </tr>
              </thead>
              <tbody>
                {sortedOutliers.map((m, i) => {
                  const acc = formatAccuracy(m[`accuracy_${activeWindow}`], m[`ci_${activeWindow}`]);
                  return (
                    <tr key={m.model_name} style={{ borderBottom: "1px solid var(--border-subtle, rgba(51,65,85,0.5))" }}>
                      <td style={{ ...tdStyle, color: "var(--text3)", fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ ...tdStyle, textAlign: "left", color: "var(--text2)", fontWeight: 500 }}>
                        {m.model_name}
                      </td>
                      <td style={{ ...tdStyle, color: acc.color, fontWeight: 600 }}>
                        {acc.text}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text3)" }}>
                        {m[`samples_${activeWindow}`] || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}

const thStyle = {
  padding: "12px 16px",
  textAlign: "center",
  color: "var(--text3)",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle = {
  padding: "12px 16px",
  textAlign: "center",
};

import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

function accuracyColor(val) {
  if (val >= 60) return "#22c55e";
  if (val >= 55) return "#4ade80";
  if (val >= 50) return "#eab308";
  return "#94a3b8";
}

export default function SectorAccuracy({ sectors }) {
  if (!sectors || sectors.length === 0) return null;

  // Only show sectors with sample_size > 50
  const filtered = sectors.filter((s) => s.sample_size > 50);
  if (filtered.length === 0) return null;

  const maxAcc = Math.max(...filtered.map((s) => s.accuracy_pct));

  return (
    <motion.div variants={fadeUp} style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
          Accuracy by Sector
        </h2>
        <p style={{ fontSize: "0.8rem", color: "var(--text3)", margin: "4px 0 0" }}>
          Consensus model accuracy across S&P 500 sectors
        </p>
      </div>

      <div style={{ padding: "16px 20px" }}>
        {filtered.map((s) => (
          <div key={s.sector} style={{ marginBottom: 14 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              marginBottom: 6,
            }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>
                {s.sector}
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--text3)" }}>
                <span style={{ fontWeight: 700, color: accuracyColor(s.accuracy_pct) }}>
                  {s.accuracy_pct.toFixed(1)}%
                </span>
                {" "}
                <span style={{ fontSize: "0.72rem" }}>({s.sample_size} samples)</span>
              </span>
            </div>
            <div style={{
              height: 8, borderRadius: 4,
              background: "var(--border)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 4,
                background: accuracyColor(s.accuracy_pct),
                width: `${(s.accuracy_pct / Math.max(maxAcc, 70)) * 100}%`,
                transition: "width 0.6s ease-out",
              }} />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

import { useState } from "react";
import api from "../../lib/api";

const CATEGORIES = [
  { key: "political", label: "Political", icon: "P" },
  { key: "economic", label: "Economic", icon: "E" },
  { key: "social", label: "Social", icon: "S" },
  { key: "technological", label: "Technological", icon: "T" },
  { key: "legal", label: "Legal", icon: "L" },
  { key: "environmental", label: "Environmental", icon: "E" },
];

const IMPACT_COLORS = {
  high: { bg: "rgba(239,68,68,0.12)", color: "var(--red)", border: "var(--red)" },
  medium: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "#f59e0b" },
  low: { bg: "rgba(34,197,94,0.12)", color: "var(--green2)", border: "var(--green2)" },
};

function ImpactBadge({ impact }) {
  const level = (impact || "medium").toLowerCase();
  const style = IMPACT_COLORS[level] || IMPACT_COLORS.medium;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.6rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        padding: "2px 8px",
        borderRadius: 12,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {level} impact
    </span>
  );
}

export default function PESTLEAnalysis({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = () => {
    setLoading(true);
    setError(null);
    api.post(`/analysis/pestle/${ticker}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to generate PESTLE analysis"))
      .finally(() => setLoading(false));
  };

  if (!data && !loading) {
    return (
      <div className="glass-card" style={{ padding: 20, textAlign: "center" }}>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 24px",
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          Generate PESTLE Analysis
        </button>
        {error && (
          <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: 10 }}>{error}</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
        <div className="pestle-spinner" />
        <p style={{ color: "var(--text3)", fontSize: "0.8rem", marginTop: 12 }}>
          Generating PESTLE analysis for {ticker}...
        </p>
        <style>{`
          .pestle-spinner {
            width: 32px; height: 32px;
            border: 3px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            margin: 0 auto;
            animation: pestle-spin 0.8s linear infinite;
          }
          @keyframes pestle-spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <div className="pestle-grid">
        {CATEGORIES.map((cat) => {
          const section = data?.[cat.key];
          if (!section) return null;
          return (
            <div key={cat.key} className="glass-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
                  {cat.label}
                </h4>
                <ImpactBadge impact={section.impact} />
              </div>
              {section.analysis && (
                <p style={{ fontSize: "0.73rem", color: "var(--text3)", lineHeight: 1.6, margin: "0 0 10px" }}>
                  {section.analysis}
                </p>
              )}
              {section.factors && section.factors.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
                  {section.factors.map((f, i) => (
                    <li key={i} style={{ fontSize: "0.7rem", color: "var(--text)", lineHeight: 1.6, marginBottom: 3 }}>
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .pestle-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        @media (max-width: 900px) {
          .pestle-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 540px) {
          .pestle-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

import { useState } from "react";
import api from "../../lib/api";

const QUADRANTS = [
  { key: "strengths", label: "Strengths", color: "var(--green2)", bg: "rgba(34,197,94,0.06)" },
  { key: "weaknesses", label: "Weaknesses", color: "var(--red)", bg: "rgba(239,68,68,0.06)" },
  { key: "opportunities", label: "Opportunities", color: "var(--primary)", bg: "rgba(59,130,246,0.06)" },
  { key: "threats", label: "Threats", color: "#f59e0b", bg: "rgba(245,158,11,0.06)" },
];

export default function SWOTAnalysis({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = () => {
    setLoading(true);
    setError(null);
    api.post(`/analysis/swot/${ticker}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to generate SWOT analysis"))
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
          Generate SWOT Analysis
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
        <div className="swot-spinner" />
        <p style={{ color: "var(--text3)", fontSize: "0.8rem", marginTop: 12 }}>
          Generating SWOT analysis for {ticker}...
        </p>
        <style>{`
          .swot-spinner {
            width: 32px; height: 32px;
            border: 3px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            margin: 0 auto;
            animation: swot-spin 0.8s linear infinite;
          }
          @keyframes swot-spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="swot-grid">
        {QUADRANTS.map((q) => {
          const items = data?.[q.key] || [];
          return (
            <div
              key={q.key}
              className="glass-card"
              style={{
                padding: 16,
                borderLeft: `3px solid ${q.color}`,
                background: q.bg,
              }}
            >
              <h4 style={{ fontSize: "0.8rem", fontWeight: 700, color: q.color, margin: "0 0 10px" }}>
                {q.label}
              </h4>
              <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
                {items.map((item, i) => (
                  <li key={i} style={{ fontSize: "0.75rem", color: "var(--text)", lineHeight: 1.6, marginBottom: 4 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {data?.summary && (
        <div className="glass-card" style={{ padding: 16 }}>
          <h4 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>
            Summary
          </h4>
          <p style={{ fontSize: "0.75rem", color: "var(--text3)", lineHeight: 1.7, margin: 0 }}>
            {data.summary}
          </p>
        </div>
      )}

      <style>{`
        .swot-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 640px) {
          .swot-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

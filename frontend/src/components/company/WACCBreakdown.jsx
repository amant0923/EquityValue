import { useState, useEffect } from "react";
import api from "../../lib/api";

const fmtPct = (v) => (v != null ? `${(Number(v) * 100).toFixed(2)}%` : "--");
const fmtPctRaw = (v) => (v != null ? `${Number(v).toFixed(2)}%` : "--");

const ROWS = [
  { key: "risk_free_rate", label: "Risk-Free Rate", bold: false },
  { key: "beta", label: "Beta", bold: false, format: (v) => (v != null ? Number(v).toFixed(2) : "--") },
  { key: "market_risk_premium", label: "Market Risk Premium", bold: false },
  { key: "cost_of_equity", label: "Cost of Equity", bold: true },
  { divider: true },
  { key: "cost_of_debt_pretax", label: "Cost of Debt (Pre-tax)", bold: false },
  { key: "effective_tax_rate", label: "Effective Tax Rate", bold: false },
  { key: "cost_of_debt_aftertax", label: "Cost of Debt (After-tax)", bold: true },
  { divider: true },
  { key: "equity_weight", label: "Equity Weight", bold: false },
  { key: "debt_weight", label: "Debt Weight", bold: false },
  { key: "wacc", label: "WACC", bold: true, highlight: true },
];

export default function WACCBreakdown({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/wacc/${ticker}`)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.detail || "Failed to load WACC data"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: "0.8rem" }}>
        Loading WACC data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card" style={{ padding: 20, textAlign: "center", color: "var(--red)", fontSize: "0.8rem" }}>
        {error}
      </div>
    );
  }

  if (!data) return null;

  const formatValue = (row) => {
    if (row.format) return row.format(data[row.key]);
    const val = data[row.key];
    if (val == null) return "--";
    // If the value is already in percentage form (e.g., 4.3 for 4.3%), display directly
    // If value < 1, treat as decimal and multiply by 100
    const n = Number(val);
    if (Math.abs(n) < 1) return fmtPct(n);
    return fmtPctRaw(n);
  };

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        WACC Build-Up
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Component</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => {
              if (row.divider) {
                return (
                  <tr key={`div-${i}`}>
                    <td colSpan={2} style={{ padding: "4px 0", borderBottom: "none" }} />
                  </tr>
                );
              }
              const isHighlight = row.highlight;
              return (
                <tr
                  key={row.key}
                  style={isHighlight ? { background: "rgba(59,130,246,0.08)" } : undefined}
                >
                  <td style={{
                    ...tdStyle,
                    fontWeight: row.bold ? 700 : 400,
                    color: isHighlight ? "var(--primary)" : "var(--text)",
                  }}>
                    {row.label}
                  </td>
                  <td style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontWeight: row.bold ? 700 : 400,
                    color: isHighlight ? "var(--primary)" : "var(--text)",
                    fontFamily: "var(--font-mono, monospace)",
                  }}>
                    {formatValue(row)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "var(--text3)",
  textTransform: "uppercase",
  letterSpacing: 0.3,
  borderBottom: "1px solid var(--border)",
};

const tdStyle = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: "0.8rem",
  color: "var(--text)",
  borderBottom: "1px solid var(--border)",
};

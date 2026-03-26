import { useState, useEffect } from "react";
import api from "../../lib/api";

const fmtB = (v) => {
  if (v == null) return "--";
  const n = Number(v);
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtEPS = (v) => (v != null ? `$${Number(v).toFixed(2)}` : "--");

export default function ForwardEstimates({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/estimates/${ticker}`)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.detail || "Failed to load estimates"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: "0.8rem" }}>
        Loading estimates...
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

  const estimates = data?.estimates || data;
  const rows = Array.isArray(estimates) ? estimates : [];

  if (rows.length === 0) {
    return (
      <div className="glass-card" style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: "0.8rem" }}>
        No forward estimates available
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Forward Consensus Estimates
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Period</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Revenue</th>
              <th style={{ ...thStyle, textAlign: "right" }}>EBITDA</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Net Income</th>
              <th style={{ ...thStyle, textAlign: "right" }}>EPS</th>
              <th style={{ ...thStyle, textAlign: "right" }}># Analysts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={tdStyle}>{r.period || r.date || `FY ${r.year}`}</td>
                <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{fmtB(r.revenue || r.estimated_revenue_avg)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{fmtB(r.ebitda || r.estimated_ebitda_avg)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{fmtB(r.net_income || r.estimated_net_income_avg)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{fmtEPS(r.eps || r.estimated_eps_avg)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{r.number_analysts || r.analysts || "--"}</td>
              </tr>
            ))}
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

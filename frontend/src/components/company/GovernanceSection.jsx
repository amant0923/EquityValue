import { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import api from "../../lib/api";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

const fmtB = (v) => {
  if (v == null) return "--";
  const n = Number(v);
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
};

const fmtComp = (v) => {
  if (v == null) return "--";
  const n = Number(v);
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

const fmtShares = (v) => {
  if (v == null) return "--";
  const n = Number(v);
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
};

const SENTIMENT_COLORS = {
  positive: { bg: "rgba(34,197,94,0.12)", color: "var(--green2)" },
  neutral: { bg: "rgba(148,163,184,0.12)", color: "var(--text3)" },
  negative: { bg: "rgba(239,68,68,0.12)", color: "var(--red)" },
};

const PIE_COLORS = ["var(--red)", "var(--primary2)"];

export default function GovernanceSection({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/governance/${ticker}`)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.detail || "Failed to load governance data"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  const capStructureData = useMemo(() => {
    if (!data?.capital_structure) return [];
    const cs = data.capital_structure;
    const debt = cs.total_debt || 0;
    const equity = cs.market_cap || 0;
    if (!debt && !equity) return [];
    return [
      { name: "Debt", value: debt },
      { name: "Equity", value: equity },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: "0.8rem" }}>
        Loading governance data...
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

  const boardCount = data.board?.length || 0;
  const femaleCount = data.board?.filter((b) => b.gender?.toLowerCase() === "female").length || 0;
  const femalePct = boardCount > 0 ? ((femaleCount / boardCount) * 100).toFixed(0) : 0;
  const sentiment = data.insider_sentiment || "neutral";
  const sentimentStyle = SENTIMENT_COLORS[sentiment.toLowerCase()] || SENTIMENT_COLORS.neutral;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Board Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.3 }}>Board Members</div>
          <div className="mono" style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{boardCount}</div>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.3 }}>Female Representation</div>
          <div className="mono" style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{femalePct}%</div>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.3 }}>Insider Sentiment</div>
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
              padding: "3px 10px", borderRadius: 12,
              background: sentimentStyle.bg, color: sentimentStyle.color,
            }}>
              {sentiment}
            </span>
          </div>
        </div>
      </div>

      {/* Key Executives */}
      {data.executives && data.executives.length > 0 && (
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>
            Key Executives
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Title</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Compensation</th>
                </tr>
              </thead>
              <tbody>
                {data.executives.map((e, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{e.name}</td>
                    <td style={tdStyle}>{e.title}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{fmtComp(e.compensation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Board of Directors */}
      {data.board && data.board.length > 0 && (
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>
            Board of Directors
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Gender</th>
                </tr>
              </thead>
              <tbody>
                {data.board.map((b, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{b.name}</td>
                    <td style={tdStyle}>{b.title}</td>
                    <td style={tdStyle}>{b.gender || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Shareholders */}
      {data.shareholders && data.shareholders.length > 0 && (
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>
            Top Shareholders
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Holder</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Shares</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Weight %</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {data.shareholders.map((s, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{s.holder || s.name}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{fmtShares(s.shares)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{s.weight != null ? `${Number(s.weight).toFixed(2)}%` : "--"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }} className="mono">{s.change != null ? fmtShares(s.change) : "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Capital Structure */}
      {capStructureData.length > 0 && (
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>
            Capital Structure
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <div style={{ width: 200, height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={capStructureData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: "var(--text3)", strokeWidth: 1 }}
                    style={{ fontSize: 10, fill: "var(--text)" }}
                  >
                    {capStructureData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} opacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtB(v)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1, minWidth: 200 }}>
              {[
                { label: "Net Debt", value: data.capital_structure?.net_debt },
                { label: "Enterprise Value", value: data.capital_structure?.enterprise_value },
                { label: "Market Cap", value: data.capital_structure?.market_cap },
                { label: "Total Debt", value: data.capital_structure?.total_debt },
              ].map((item) => (
                <div key={item.label} style={{ background: "var(--surface2)", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.3 }}>{item.label}</div>
                  <div className="mono" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{fmtB(item.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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

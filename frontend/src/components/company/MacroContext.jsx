import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import api from "../../lib/api";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

const fmtPct = (v) => (v != null ? `${Number(v).toFixed(1)}%` : "--");

function MacroCard({ label, value, suffix = "%" }) {
  return (
    <div className="macro-card">
      <div className="macro-card-label">{label}</div>
      <div className="macro-card-value mono">
        {value != null ? `${Number(value).toFixed(2)}${suffix}` : "--"}
      </div>
    </div>
  );
}

export default function MacroContext({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get("/macro/overview")
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail || "Failed to load macro data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const current = data?.current;

  const gdpData = useMemo(() => {
    if (!data?.gdp_history) return [];
    return data.gdp_history
      .filter((_, i) => i % 4 === 0 || i === data.gdp_history.length - 1)
      .map((d) => ({ date: d.date?.slice(0, 4), value: d.value }));
  }, [data]);

  const inflationRateData = useMemo(() => {
    if (!data?.inflation_history) return [];
    return data.inflation_history
      .filter((_, i) => i % 4 === 0 || i === data.inflation_history.length - 1)
      .map((d, i) => ({
        date: d.date?.slice(0, 4),
        inflation: d.value,
        fed_rate: data.fed_rate_history?.[i * 4]?.value ?? data.fed_rate_history?.[i]?.value,
      }));
  }, [data]);

  const consumerData = useMemo(() => {
    if (!data?.consumer_confidence_history) return [];
    return data.consumer_confidence_history
      .filter((_, i) => i % 4 === 0 || i === data.consumer_confidence_history.length - 1)
      .map((d) => ({ date: d.date?.slice(0, 4), value: d.value }));
  }, [data]);

  const unemploymentData = useMemo(() => {
    if (!data?.unemployment_history) return [];
    return data.unemployment_history
      .filter((_, i) => i % 4 === 0 || i === data.unemployment_history.length - 1)
      .map((d) => ({ date: d.date?.slice(0, 4), value: d.value }));
  }, [data]);

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: "0.8rem" }}>
        Loading macro data...
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

  return (
    <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
      <button
        onClick={() => setExpanded((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text)",
          fontSize: "0.85rem",
          fontWeight: 700,
        }}
      >
        <span>Macroeconomic Context</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Key macro cards - always visible */}
      <div style={{ padding: "0 20px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
        <MacroCard label="GDP Growth" value={current?.gdp_growth} />
        <MacroCard label="Inflation" value={current?.inflation} />
        <MacroCard label="Fed Funds Rate" value={current?.fed_rate} />
        <MacroCard label="Consumer Confidence" value={current?.consumer_confidence} suffix="" />
        <MacroCard label="Unemployment" value={current?.unemployment} />
      </div>

      {expanded && (
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* GDP Growth */}
          {gdpData.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>
                GDP Growth
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={gdpData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} tickFormatter={fmtPct} axisLine={false} tickLine={false} width={50} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtPct(v), "GDP Growth"]} />
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Inflation vs Fed Funds Rate */}
          {inflationRateData.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>
                Inflation vs Fed Funds Rate
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={inflationRateData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} tickFormatter={fmtPct} axisLine={false} tickLine={false} width={50} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [fmtPct(v), name]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--text3)" }} />
                  <Line type="monotone" dataKey="inflation" name="Inflation" stroke="var(--red)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fed_rate" name="Fed Funds Rate" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Consumer Confidence + Unemployment side by side */}
          <div className="macro-dual-grid">
            {consumerData.length > 0 && (
              <div>
                <h4 style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>
                  Consumer Confidence
                </h4>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={consumerData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toFixed(1), "Confidence"]} />
                    <Line type="monotone" dataKey="value" stroke="var(--green2)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {unemploymentData.length > 0 && (
              <div>
                <h4 style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>
                  Unemployment Rate
                </h4>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={unemploymentData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} tickFormatter={fmtPct} axisLine={false} tickLine={false} width={50} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtPct(v), "Unemployment"]} />
                    <Line type="monotone" dataKey="value" stroke="var(--red)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .macro-card {
          background: var(--surface2);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .macro-card-label {
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 4px;
        }
        .macro-card-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text);
        }
        .macro-dual-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 640px) {
          .macro-dual-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

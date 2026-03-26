import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

const fmtPct = (v) => (v != null ? `${Number(v).toFixed(1)}%` : "--");

export default function ReturnRatiosChart({ data }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data]
      .sort((a, b) => (a.period_date || "").localeCompare(b.period_date || ""))
      .slice(-12)
      .map((r) => ({
        year: r.period_date?.slice(0, 4) || "",
        roe: r.roe != null ? Number(r.roe) * 100 : null,
        roa: r.roa != null ? Number(r.roa) * 100 : null,
        roic: r.roic != null ? Number(r.roic) * 100 : null,
      }));
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Return Ratios
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="year"
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            tickFormatter={fmtPct}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [fmtPct(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text3)" }} />
          <Line type="monotone" dataKey="roe" name="ROE" stroke="var(--green2)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="roa" name="ROA" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="roic" name="ROIC" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

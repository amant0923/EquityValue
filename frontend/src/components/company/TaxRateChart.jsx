import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

const fmtPct = (v) => (v != null ? `${Number(v).toFixed(1)}%` : "--");

export default function TaxRateChart({ data }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data]
      .sort((a, b) => (a.period_date || "").localeCompare(b.period_date || ""))
      .slice(-10)
      .map((r) => {
        const tax = Number(r.income_tax_expense) || 0;
        const pretax = Number(r.income_before_tax) || 0;
        const rate = pretax !== 0 ? (tax / pretax) * 100 : null;
        return {
          year: r.period_date?.slice(0, 4) || "",
          rate,
        };
      })
      .filter((d) => d.rate != null);
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Effective Tax Rate
      </h3>
      <ResponsiveContainer width="100%" height={200}>
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
            width={50}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [fmtPct(v), "Effective Tax Rate"]}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--primary)" }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

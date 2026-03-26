import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

const fmtB = (v) => {
  if (v == null) return "--";
  const n = Number(v);
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
};

export default function CashFlowTrends({ data }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data]
      .sort((a, b) => (a.period_date || "").localeCompare(b.period_date || ""))
      .slice(-10)
      .map((r) => ({
        year: r.period_date?.slice(0, 4) || "",
        ocf: r.operating_cash_flow,
        fcf: r.free_cash_flow,
      }));
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Cash Flow Trends
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="year"
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            tickFormatter={fmtB}
            axisLine={false}
            tickLine={false}
            width={65}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [fmtB(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text3)" }} />
          <Bar dataKey="ocf" name="Operating Cash Flow" fill="var(--primary)" opacity={0.7} radius={[3, 3, 0, 0]} />
          <Bar dataKey="fcf" name="Free Cash Flow" fill="var(--green2)" opacity={0.7} radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="fcf" name="FCF Trend" stroke="var(--green2)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

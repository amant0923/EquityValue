import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const fmtB = (v) => {
  if (v == null) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
};

export default function RevenueChart({ rows }) {
  const data = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return [...rows]
      .sort((a, b) => a.period_date.localeCompare(b.period_date))
      .slice(-12)
      .map((r) => ({
        period: formatLabel(r.period_date, r.period_type),
        revenue: r.revenue,
        gross_profit: r.gross_profit,
      }));
  }, [rows]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Revenue & Gross Profit
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="period"
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
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v, name) => [fmtB(v), name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--text3)" }}
          />
          <Bar dataKey="revenue" name="Revenue" fill="var(--primary)" opacity={0.8} radius={[3, 3, 0, 0]} />
          <Bar dataKey="gross_profit" name="Gross Profit" fill="var(--green2)" opacity={0.7} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatLabel(dateStr, periodType) {
  if (!dateStr) return "";
  const y = dateStr.slice(0, 4);
  if (periodType && periodType.startsWith("Q")) return `${periodType} ${y}`;
  return `FY ${y}`;
}

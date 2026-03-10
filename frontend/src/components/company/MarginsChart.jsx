import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const fmtPct = (v) => (v != null ? `${(v * 100).toFixed(1)}%` : "—");

export default function MarginsChart({ rows }) {
  const data = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return [...rows]
      .sort((a, b) => a.period_date.localeCompare(b.period_date))
      .slice(-12)
      .map((r) => {
        const rev = r.revenue || 0;
        return {
          period: formatLabel(r.period_date, r.period_type),
          gross_margin: rev ? (r.gross_profit || 0) / rev : null,
          operating_margin: rev ? (r.operating_income || 0) / rev : null,
          net_margin: rev ? (r.net_income || 0) / rev : null,
        };
      });
  }, [rows]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Profit Margins
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="period"
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v, name) => [fmtPct(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text3)" }} />
          <Line
            dataKey="gross_margin"
            name="Gross Margin"
            stroke="var(--green2)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            dataKey="operating_margin"
            name="Operating Margin"
            stroke="var(--primary2)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            dataKey="net_margin"
            name="Net Margin"
            stroke="var(--yellow2)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
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

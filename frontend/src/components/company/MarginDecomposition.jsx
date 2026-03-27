import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

const fmtPct = (v) => (v != null ? `${(v * 100).toFixed(1)}%` : "--");

export default function MarginDecomposition({ rows }) {
  const data = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return [...rows]
      .sort((a, b) => (a.period_date || "").localeCompare(b.period_date || ""))
      .slice(-10)
      .map((r) => {
        const rev = r.revenue || 0;
        const ebitda = (r.operating_income || 0) + (r.depreciation_and_amortization || 0);
        return {
          period: formatLabel(r.period_date, r.period_type),
          gross_margin: rev ? (r.gross_profit || 0) / rev : null,
          ebitda_margin: rev ? ebitda / rev : null,
          net_margin: rev ? (r.net_income || 0) / rev : null,
        };
      });
  }, [rows]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Margin Decomposition
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradGross" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--green2)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--green2)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradEbitda" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
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
            contentStyle={tooltipStyle}
            formatter={(v, name) => [fmtPct(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text3)" }} />
          <Area
            type="monotone"
            dataKey="gross_margin"
            name="Gross Margin"
            stroke="var(--green2)"
            fill="url(#gradGross)"
            strokeWidth={2}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="ebitda_margin"
            name="EBITDA Margin"
            stroke="var(--primary)"
            fill="url(#gradEbitda)"
            strokeWidth={2}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="net_margin"
            name="Net Margin"
            stroke="#8b5cf6"
            fill="url(#gradNet)"
            strokeWidth={2}
            connectNulls
          />
        </AreaChart>
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

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

const fmtB = (v) => {
  if (v == null) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
};

export default function BalanceSheetChart({ rows }) {
  const data = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return [...rows]
      .sort((a, b) => (a.period_date || "").localeCompare(b.period_date || ""))
      .slice(-12)
      .map((r) => ({
        period: formatLabel(r.period_date, r.period_type),
        total_assets: r.total_assets,
        total_liabilities: r.total_liabilities ? -Math.abs(r.total_liabilities) : null,
        equity: r.total_stockholders_equity ? -Math.abs(r.total_stockholders_equity) : null,
      }));
  }, [rows]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Assets vs Liabilities + Equity
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} stackOffset="sign">
          <XAxis
            dataKey="period"
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            tickFormatter={(v) => fmtB(Math.abs(v))}
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
            formatter={(v, name) => [fmtB(Math.abs(v)), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text3)" }} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Bar dataKey="total_assets" name="Total Assets" fill="var(--primary)" opacity={0.8} radius={[3, 3, 0, 0]} />
          <Bar dataKey="total_liabilities" name="Total Liabilities" fill="var(--red2)" opacity={0.7} stackId="neg" radius={[0, 0, 3, 3]} />
          <Bar dataKey="equity" name="Equity" fill="var(--green2)" opacity={0.7} stackId="neg" />
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

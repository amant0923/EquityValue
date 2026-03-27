import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function PerShareChart({ incomeRows, balanceRows }) {
  const data = useMemo(() => {
    if ((!incomeRows || incomeRows.length === 0) && (!balanceRows || balanceRows.length === 0)) return [];

    // Build a map of period_date -> values
    const map = {};

    if (incomeRows) {
      for (const r of incomeRows) {
        if (!map[r.period_date]) map[r.period_date] = { period_date: r.period_date, period_type: r.period_type };
        map[r.period_date].eps = r.eps_diluted || r.eps;
      }
    }
    if (balanceRows) {
      for (const r of balanceRows) {
        if (!map[r.period_date]) map[r.period_date] = { period_date: r.period_date, period_type: r.period_type };
        map[r.period_date].book_value = r.book_value_per_share;
      }
    }

    return Object.values(map)
      .sort((a, b) => (a.period_date || "").localeCompare(b.period_date || ""))
      .slice(-12)
      .map((r) => ({
        period: formatLabel(r.period_date, r.period_type),
        eps: r.eps,
        book_value: r.book_value,
      }));
  }, [incomeRows, balanceRows]);

  if (data.length === 0) return null;

  const hasEPS = data.some((d) => d.eps != null);
  const hasBV = data.some((d) => d.book_value != null);

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Per Share Metrics
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
            tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text3)" }} />
          {hasEPS && (
            <Bar dataKey="eps" name="EPS (Diluted)" fill="var(--primary2)" opacity={0.8} radius={[3, 3, 0, 0]} />
          )}
          {hasBV && (
            <Bar dataKey="book_value" name="Book Value / Share" fill="var(--green2)" opacity={0.7} radius={[3, 3, 0, 0]} />
          )}
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

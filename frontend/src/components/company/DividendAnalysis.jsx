import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

export default function DividendAnalysis({ data }) {
  const { annualData, currentYield, frequency } = useMemo(() => {
    if (!data || data.length === 0) return { annualData: [], currentYield: null, frequency: null };

    // Aggregate dividends by year
    const byYear = {};
    let latestYield = null;
    let latestFreq = null;

    const sorted = [...data].sort((a, b) => (a.ex_date || "").localeCompare(b.ex_date || ""));

    for (const d of sorted) {
      const year = d.ex_date?.slice(0, 4);
      if (!year) continue;
      if (!byYear[year]) byYear[year] = 0;
      byYear[year] += Number(d.amount) || 0;
      if (d.yield != null) latestYield = d.yield;
      if (d.frequency) latestFreq = d.frequency;
    }

    const annual = Object.entries(byYear)
      .map(([year, total]) => ({ year, total: Number(total.toFixed(4)) }))
      .sort((a, b) => a.year.localeCompare(b.year))
      .slice(-10);

    return { annualData: annual, currentYield: latestYield, frequency: latestFreq };
  }, [data]);

  if (annualData.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Dividend History
      </h3>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={annualData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="year"
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            tickFormatter={(v) => `$${v.toFixed(2)}`}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [`$${Number(v).toFixed(4)}`, "Annual Dividend"]}
          />
          <Bar dataKey="total" name="Annual Dividend" fill="var(--green2)" opacity={0.8} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {currentYield != null && (
          <span style={{
            fontSize: "0.7rem", fontWeight: 600, padding: "4px 12px",
            borderRadius: 12, background: "rgba(34,197,94,0.1)", color: "var(--green2)",
            border: "1px solid var(--green2)",
          }}>
            Yield: {(Number(currentYield) * 100).toFixed(2)}%
          </span>
        )}
        {frequency && (
          <span style={{
            fontSize: "0.7rem", fontWeight: 600, padding: "4px 12px",
            borderRadius: 12, background: "rgba(59,130,246,0.1)", color: "var(--primary)",
            border: "1px solid var(--primary)",
          }}>
            {frequency}
          </span>
        )}
      </div>
    </div>
  );
}

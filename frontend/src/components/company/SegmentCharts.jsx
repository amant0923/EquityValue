import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

const COLORS = [
  "var(--primary)", "var(--green2)", "var(--yellow2)", "var(--red2)",
  "var(--primary2)", "#8b5cf6", "#f97316", "#06b6d4", "#ec4899", "#84cc16",
];

const fmtB = (v) => {
  if (v == null) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
};

export default function SegmentCharts({ segments }) {
  if (!segments) return null;

  const hasProduct = segments.product && segments.product.length > 0;
  const hasGeo = segments.geographic && segments.geographic.length > 0;

  if (!hasProduct && !hasGeo) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {hasProduct && <SegmentSection title="Revenue by Product Segment" data={segments.product} />}
      {hasGeo && <SegmentSection title="Revenue by Geography" data={segments.geographic} />}
    </div>
  );
}

function SegmentSection({ title, data }) {
  const { stackedData, segmentNames, donutData, latestPeriod } = useMemo(() => {
    // Get unique segment names and periods
    const nameSet = new Set();
    const periodMap = {};

    for (const row of data) {
      nameSet.add(row.segment_name);
      if (!periodMap[row.period_date]) periodMap[row.period_date] = {};
      periodMap[row.period_date][row.segment_name] = row.revenue;
    }

    const names = [...nameSet];
    const periods = Object.keys(periodMap).sort();
    const stacked = periods.slice(-8).map((p) => {
      const entry = { period: p.slice(0, 4) };
      for (const name of names) {
        entry[name] = periodMap[p]?.[name] || 0;
      }
      return entry;
    });

    // Donut: latest period
    const latest = periods[periods.length - 1];
    const donut = names
      .map((name) => ({
        name,
        value: periodMap[latest]?.[name] || 0,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    return { stackedData: stacked, segmentNames: names, donutData: donut, latestPeriod: latest };
  }, [data]);

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        {title}
      </h3>

      <div className="seg-grid">
        {/* Stacked bar */}
        <div style={{ minWidth: 0 }}>
          <h4 style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>
            Over Time
          </h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stackedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <Legend wrapperStyle={{ fontSize: 10, color: "var(--text3)" }} />
              {segmentNames.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="seg"
                  fill={COLORS[i % COLORS.length]}
                  opacity={0.8}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut */}
        <div style={{ minWidth: 0 }}>
          <h4 style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>
            Latest Period ({latestPeriod?.slice(0, 4)})
          </h4>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="45%"
                outerRadius="75%"
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: "var(--text3)", strokeWidth: 1 }}
                style={{ fontSize: 10, fill: "var(--text2)" }}
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => [fmtB(v), "Revenue"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <style>{`
        .seg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 768px) {
          .seg-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

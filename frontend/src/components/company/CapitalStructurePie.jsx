import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
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
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
};

const COLORS = ["#ef4444", "var(--primary2)"];

export default function CapitalStructurePie({ data }) {
  const pieData = useMemo(() => {
    if (!data) return [];
    const debt = data.total_debt || 0;
    const equity = data.market_cap || 0;
    if (!debt && !equity) return [];
    return [
      { name: "Debt", value: debt },
      { name: "Equity", value: equity },
    ];
  }, [data]);

  if (pieData.length === 0) return null;

  const cards = [
    { label: "Market Cap", value: data?.market_cap },
    { label: "Total Debt", value: data?.total_debt },
    { label: "Net Debt", value: data?.net_debt },
    { label: "Enterprise Value", value: data?.enterprise_value },
  ];

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Capital Structure
      </h3>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <ResponsiveContainer width={220} height={200}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: "var(--text3)", strokeWidth: 1 }}
              style={{ fontSize: 10, fill: "var(--text)" }}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} opacity={0.85} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtB(v)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "var(--surface2)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.3 }}>
              {c.label}
            </div>
            <div className="mono" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
              {fmtB(c.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

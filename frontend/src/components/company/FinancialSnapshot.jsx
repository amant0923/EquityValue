import { BarChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart } from "recharts";

const fmtB = (v) => {
  if (v == null) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
};

export default function FinancialSnapshot({ quarters }) {
  if (!quarters || quarters.length === 0) return null;

  // Reverse to chronological order, take last 8
  const sorted = [...quarters].sort((a, b) => a.period_date.localeCompare(b.period_date)).slice(-8);

  const chartData = sorted.map((q) => ({
    period: `${q.period_type} ${q.period_date?.slice(0, 4)}`,
    revenue: q.revenue,
    net_income: q.net_income,
    eps: q.eps_diluted || q.eps,
    gross_profit: q.gross_profit,
  }));

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 className="fs-title">Quarterly Financial Snapshot</h3>

      <div className="fs-chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="period"
              tick={{ fill: "var(--text3)", fontSize: 10 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "var(--text3)", fontSize: 10 }}
              tickFormatter={(v) => fmtB(v)}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "var(--text3)", fontSize: 10 }}
              tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => {
                if (name === "EPS") return [`$${Number(value).toFixed(2)}`, name];
                return [fmtB(value), name];
              }}
            />
            <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="var(--primary)" opacity={0.7} radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="net_income" name="Net Income" fill="var(--green2)" opacity={0.6} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" dataKey="eps" name="EPS" stroke="var(--yellow2)" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <style>{`
        .fs-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 14px;
        }
        .fs-chart-wrap {
          width: 100%;
        }
      `}</style>
    </div>
  );
}

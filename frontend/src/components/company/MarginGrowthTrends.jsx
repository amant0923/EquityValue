import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const fmtPct = (v) => v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—";

export default function MarginGrowthTrends({ quarters, growth }) {
  if ((!quarters || quarters.length === 0) && (!growth || growth.length === 0)) return null;

  // Build chart data from quarters (margins)
  const sorted = quarters
    ? [...quarters].sort((a, b) => a.period_date.localeCompare(b.period_date)).slice(-8)
    : [];

  const marginData = sorted.map((q) => ({
    period: `${q.period_type} ${q.period_date?.slice(0, 4)}`,
    gross_margin: q.gross_profit && q.revenue ? q.gross_profit / q.revenue : null,
    operating_margin: q.operating_income && q.revenue ? q.operating_income / q.revenue : null,
    net_margin: q.net_income && q.revenue ? q.net_income / q.revenue : null,
  }));

  // Build growth data
  const growthSorted = growth
    ? [...growth].sort((a, b) => a.period_date.localeCompare(b.period_date)).slice(-8)
    : [];

  const growthData = growthSorted.map((g) => ({
    period: `${g.period_type} ${g.period_date?.slice(0, 4)}`,
    revenue_growth: g.revenue_growth,
    net_income_growth: g.net_income_growth,
    eps_growth: g.eps_growth,
  }));

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 className="mgt-title">Margin & Growth Trends</h3>

      <div className="mgt-grid">
        {marginData.length > 0 && (
          <div className="mgt-chart-box">
            <h4 className="mgt-subtitle">Margins</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={marginData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="period" tick={{ fill: "var(--text3)", fontSize: 9 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis tick={{ fill: "var(--text3)", fontSize: 9 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v, name) => [fmtPct(v), name]}
                />
                <Line dataKey="gross_margin" name="Gross" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                <Line dataKey="operating_margin" name="Operating" stroke="var(--primary2)" strokeWidth={2} dot={{ r: 2 }} />
                <Line dataKey="net_margin" name="Net" stroke="var(--yellow2)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {growthData.length > 0 && (
          <div className="mgt-chart-box">
            <h4 className="mgt-subtitle">Growth</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={growthData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="period" tick={{ fill: "var(--text3)", fontSize: 9 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis tick={{ fill: "var(--text3)", fontSize: 9 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v, name) => [fmtPct(v), name]}
                />
                <Line dataKey="revenue_growth" name="Revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                <Line dataKey="net_income_growth" name="Net Income" stroke="var(--primary2)" strokeWidth={2} dot={{ r: 2 }} />
                <Line dataKey="eps_growth" name="EPS" stroke="var(--yellow2)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <style>{`
        .mgt-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 14px;
        }
        .mgt-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .mgt-chart-box {
          min-width: 0;
        }
        .mgt-subtitle {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 8px;
        }
        @media (max-width: 768px) {
          .mgt-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

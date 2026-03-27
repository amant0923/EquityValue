import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

const fmtPct = (v) => (v != null ? `${Number(v).toFixed(1)}%` : "--");

export default function ReturnRatiosChart({ data, balanceRows, cashflowRows }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Build lookup maps for balance sheet and cashflow by period_date
    const balanceMap = {};
    if (balanceRows) {
      for (const r of balanceRows) {
        if (r.period_date) balanceMap[r.period_date] = r;
      }
    }
    const cfMap = {};
    if (cashflowRows) {
      for (const r of cashflowRows) {
        if (r.period_date) cfMap[r.period_date] = r;
      }
    }

    return [...data]
      .sort((a, b) => (a.period_date || "").localeCompare(b.period_date || ""))
      .slice(-12)
      .map((r) => {
        const bal = balanceMap[r.period_date];
        const cf = cfMap[r.period_date];

        // ROCE = EBIT / Capital Employed, where Capital Employed = Total Assets - Current Liabilities
        let roce = null;
        if (bal && r.operating_income != null) {
          const totalAssets = bal.total_assets || 0;
          const currentLiabilities = bal.total_current_liabilities || 0;
          const capitalEmployed = totalAssets - currentLiabilities;
          if (capitalEmployed > 0) {
            roce = (r.operating_income / capitalEmployed) * 100;
          }
        }

        // FCF Margin = Free Cash Flow / Revenue
        let fcfMargin = null;
        if (cf && r.revenue) {
          const fcf = cf.free_cash_flow;
          if (fcf != null && r.revenue > 0) {
            fcfMargin = (fcf / r.revenue) * 100;
          }
        }

        return {
          year: r.period_date?.slice(0, 4) || "",
          roe: r.roe != null ? Number(r.roe) * 100 : null,
          roa: r.roa != null ? Number(r.roa) * 100 : null,
          roic: r.roic != null ? Number(r.roic) * 100 : null,
          roce,
          fcfMargin,
        };
      });
  }, [data, balanceRows, cashflowRows]);

  if (chartData.length === 0) return null;

  // Only show lines that have at least one non-null value
  const hasRoce = chartData.some((d) => d.roce != null);
  const hasFcfMargin = chartData.some((d) => d.fcfMargin != null);

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", margin: "0 0 14px" }}>
        Return Ratios
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="year"
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text3)", fontSize: 10 }}
            tickFormatter={fmtPct}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [fmtPct(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text3)" }} />
          <Line type="monotone" dataKey="roe" name="ROE" stroke="var(--green2)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="roa" name="ROA" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="roic" name="ROIC" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          {hasRoce && (
            <Line type="monotone" dataKey="roce" name="ROCE" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          )}
          {hasFcfMargin && (
            <Line type="monotone" dataKey="fcfMargin" name="FCF Margin" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
const COLORS = { "Undervalued": "#10b981", "Overvalued": "#ef4444", "Fairly Valued": "#f59e0b" };
const shorten = name => name
  .replace(" (Discounted Cash Flow)", "")
  .replace(" Comparables", "")
  .replace("Gordon Growth Model (DDM)", "DDM")
  .replace("Price-to-Book (P/B)", "P/B")
  .replace("Capitalization of Earnings", "Cap. Earnings")
  .replace("Residual Income", "Res. Income")
  .replace("Graham Number", "Graham");

export default function ValuationChart({ valuations, currentPrice }) {
  const data = valuations.map(v => ({ name: shorten(v.model), intrinsic: v.intrinsic_value, verdict: v.verdict }));
  return (
    <div className="chart-wrap">
      <p className="chart-title">Intrinsic Value vs Current Price</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="2 4" stroke="#1e2231" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#60697a", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#60697a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} domain={["auto","auto"]} />
          <Tooltip
            contentStyle={{ background: "#0e1016", border: "1px solid #1e2231", borderRadius: "6px", fontSize: "12px", color: "#f1f5f9" }}
            formatter={val => [`$${val}`, "Intrinsic Value"]}
          />
          <ReferenceLine y={currentPrice} stroke="#3b82f6" strokeDasharray="5 3" strokeWidth={1}
            label={{ value: `$${currentPrice}`, fill: "#3b82f6", fontSize: 10, position: "insideTopRight" }} />
          <Bar dataKey="intrinsic" radius={[3,3,0,0]}>
            {data.map((e, i) => <Cell key={i} fill={COLORS[e.verdict] || "#60697a"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <style>{`
        .chart-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 20px 12px; }
        .chart-title { font-size: 0.72rem; font-weight: 700; color: var(--text2); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 16px; }
      `}</style>
    </div>
  );
}

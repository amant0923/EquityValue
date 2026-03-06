import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import axios from "axios";

// FIX: was hardcoded to localhost:8000 — use env var so it works on Vercel
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function PriceChart({ ticker, currentPrice }) {
  const [data, setData]       = useState([]);
  const [period, setPeriod]   = useState("1y");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(false);
    axios.get(`${API}/history/${ticker}?period=${period}`)
      .then(r => {
        const prices = r.data.prices;
        // FIX: backend now always returns prices object (never 404)
        if (prices && prices.dates && prices.dates.length > 0) {
          const mapped = prices.dates.map((t, i) => ({
            t,
            c: prices.closes[i],
          })).filter(d => d.c != null);
          setData(mapped);
        } else {
          setData([]);
        }
      })
      .catch(() => { setData([]); setError(true); })
      .finally(() => setLoading(false));
  }, [ticker, period]);

  const min = data.length ? Math.min(...data.map(d => d.c)) * 0.97 : 0;
  const max = data.length ? Math.max(...data.map(d => d.c)) * 1.03 : 0;
  const first = data[0]?.c;
  const last  = data[data.length - 1]?.c;
  const change = first ? ((last - first) / first * 100) : 0;
  const color = change >= 0 ? "var(--green2)" : "var(--red2)";

  const fmt = ts => {
    const d = new Date(ts);
    return period === "1y"
      ? d.toLocaleDateString("en-GB", { month: "short", day: "numeric" })
      : d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  };

  return (
    <div className="pc-wrap">
      <div className="pc-header">
        <div>
          <span className="pc-title">Price History</span>
          {data.length > 0 && (
            <span className="pc-change" style={{ color }}>
              {change >= 0 ? "+" : ""}{change.toFixed(1)}% ({period})
            </span>
          )}
        </div>
        <div className="pc-periods">
          {["1y","5y"].map(p => (
            <button
              key={p}
              className={`pc-period-btn ${period === p ? "active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="pc-loading">Loading chart…</div>
      )}

      {/* FIX: show empty state instead of blank/broken chart */}
      {!loading && data.length === 0 && (
        <div className="pc-loading" style={{ color: "var(--text3)", fontSize: "0.78rem" }}>
          {error ? "Price history unavailable for this ticker." : "No price data available."}
        </div>
      )}

      {!loading && data.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="t"
              tickFormatter={fmt}
              tick={{ fill: "var(--text3)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[min, max]}
              tick={{ fill: "var(--text3)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `$${v}`}
              width={55}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface2)",
                border: "1px solid var(--border2)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={v => [`$${v}`, "Price"]}
              labelFormatter={l =>
                new Date(l).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })
              }
            />
            {currentPrice && (
              <ReferenceLine
                y={currentPrice}
                stroke="var(--primary)"
                strokeDasharray="4 2"
                strokeWidth={1}
              />
            )}
            <Line type="monotone" dataKey="c" stroke={color} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <style>{`
        .pc-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 20px 12px; }
        .pc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .pc-title { font-size: 0.72rem; font-weight: 700; color: var(--text2); letter-spacing: 0.8px; text-transform: uppercase; margin-right: 10px; }
        .pc-change { font-size: 0.78rem; font-weight: 600; }
        .pc-periods { display: flex; gap: 4px; }
        .pc-period-btn { background: var(--surface2); border: 1px solid var(--border); color: var(--text3); font-size: 0.68rem; padding: 3px 10px; border-radius: 4px; cursor: pointer; font-family: inherit; }
        .pc-period-btn.active { background: var(--primary); border-color: var(--primary); color: white; }
        .pc-loading { height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text3); font-size: 0.8rem; }
      `}</style>
    </div>
  );
}

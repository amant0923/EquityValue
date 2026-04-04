import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import api from "../../lib/api";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text)",
};

const PEER_PALETTE = [
  "var(--primary)",
  "var(--primary2)",
  "var(--green2)",
  "var(--red)",
  "var(--yellow)",
];

const fmtB = (v) => {
  if (v == null) return "--";
  const n = Number(v);
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return n.toFixed(1);
};

const fmtPct = (v) => (v != null ? `${Number(v).toFixed(1)}%` : "--");

function MiniBarChart({ title, data, dataKey, subjectTicker, formatter }) {
  return (
    <div className="glass-card" style={{ padding: 16 }}>
      <h4 style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>
        {title}
      </h4>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="ticker"
            tick={{ fill: "var(--text3)", fontSize: 9 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text3)", fontSize: 9 }}
            tickFormatter={formatter || ((v) => v)}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            formatter={(v) => [formatter ? formatter(v) : v, title]}
          />
          <Bar dataKey={dataKey} radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => {
              const isSubject = entry.ticker === subjectTicker;
              const color = isSubject
                ? "var(--primary2)"
                : PEER_PALETTE[i % PEER_PALETTE.length];
              return (
                <Cell
                  key={i}
                  fill={color}
                  opacity={isSubject ? 1 : 0.7}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PeerComparisonCharts({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/comps/${ticker}`)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.detail || "Failed to load peer data"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  const peers = useMemo(() => {
    if (!data) return [];
    // data could be { peers: [...] } or array directly
    const list = Array.isArray(data) ? data : data.peers || [];
    return list.slice(0, 8);
  }, [data]);

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: "0.8rem" }}>
        Loading peer comparison...
      </div>
    );
  }

  if (error || peers.length === 0) {
    return (
      <div className="glass-card" style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: "0.8rem" }}>
        {error || "No peer comparison data available"}
      </div>
    );
  }

  const peData = peers.map((p) => ({ ticker: p.ticker || p.symbol, value: p.pe_ratio || p.pe })).filter((d) => d.value != null);
  const revGrowthData = peers.map((p) => ({ ticker: p.ticker || p.symbol, value: p.revenue_growth != null ? p.revenue_growth * 100 : null })).filter((d) => d.value != null);
  const marginData = peers.map((p) => ({ ticker: p.ticker || p.symbol, value: p.profit_margin != null ? p.profit_margin * 100 : (p.net_margin != null ? p.net_margin * 100 : null) })).filter((d) => d.value != null);
  const mcapData = peers.map((p) => ({ ticker: p.ticker || p.symbol, value: p.market_cap != null ? p.market_cap / 1e9 : null })).filter((d) => d.value != null);

  return (
    <div className="peer-charts-grid">
      {peData.length > 0 && (
        <MiniBarChart title="P/E Ratio" data={peData} dataKey="value" subjectTicker={ticker} formatter={(v) => Number(v).toFixed(1)} />
      )}
      {revGrowthData.length > 0 && (
        <MiniBarChart title="Revenue Growth %" data={revGrowthData} dataKey="value" subjectTicker={ticker} formatter={fmtPct} />
      )}
      {marginData.length > 0 && (
        <MiniBarChart title="Profit Margin %" data={marginData} dataKey="value" subjectTicker={ticker} formatter={fmtPct} />
      )}
      {mcapData.length > 0 && (
        <MiniBarChart title="Market Cap ($B)" data={mcapData} dataKey="value" subjectTicker={ticker} formatter={(v) => `$${Number(v).toFixed(1)}B`} />
      )}

      <style>{`
        .peer-charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 640px) {
          .peer-charts-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

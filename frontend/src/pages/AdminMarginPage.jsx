import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import api from "../lib/api";

export default function AdminMarginPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/margins")
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, color: "var(--text3)" }}>Loading margin data...</div>;
  if (!data) return <div style={{ padding: 40, color: "var(--text3)" }}>Could not load margin data. Admin access required.</div>;

  const marginPct = data.revenue > 0 ? ((data.revenue - data.total_cost) / data.revenue * 100).toFixed(1) : "N/A";

  return (
    <div className="amg-wrap">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="amg-title">Margin Dashboard</h1>
        <p className="amg-sub">Revenue vs infrastructure costs this month</p>

        <div className="amg-summary">
          <div className="amg-stat amg-stat--green">
            <span className="amg-stat-label">Revenue (est.)</span>
            <span className="amg-stat-val mono">${data.revenue?.toFixed(2)}</span>
          </div>
          <div className="amg-stat amg-stat--red">
            <span className="amg-stat-label">Total Cost (est.)</span>
            <span className="amg-stat-val mono">${data.total_cost?.toFixed(2)}</span>
          </div>
          <div className="amg-stat">
            <span className="amg-stat-label">Margin</span>
            <span className="amg-stat-val mono" style={{ color: parseFloat(marginPct) > 0 ? "#22c55e" : "#ef4444" }}>
              {marginPct}%
            </span>
          </div>
          <div className="amg-stat">
            <span className="amg-stat-label">API Calls</span>
            <span className="amg-stat-val mono">{data.total_calls?.toLocaleString()}</span>
          </div>
        </div>

        <h2 className="amg-section">Subscriber Breakdown</h2>
        <div className="amg-table">
          <div className="amg-row amg-row--header">
            <span>Plan</span><span>Count</span><span>Est. MRR</span>
          </div>
          {(data.subscribers || []).map(s => (
            <div key={s.plan} className="amg-row">
              <span className="amg-plan-name">{s.plan}</span>
              <span className="mono">{s.count}</span>
              <span className="mono">${s.mrr?.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <h2 className="amg-section">Cost by Endpoint</h2>
        <div className="amg-table">
          <div className="amg-row amg-row--header">
            <span>Endpoint</span><span>Calls</span><span>Est. Cost</span>
          </div>
          {(data.by_endpoint || []).map(e => (
            <div key={e.endpoint} className="amg-row">
              <span className="mono" style={{ fontSize: "0.75rem" }}>{e.endpoint}</span>
              <span className="mono">{e.calls?.toLocaleString()}</span>
              <span className="mono">${e.cost?.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <style>{`
        .amg-wrap { max-width: 800px; margin: 0 auto; }
        .amg-title { font-size: 1.4rem; font-weight: 700; color: var(--text); letter-spacing: -0.5px; margin-bottom: 4px; }
        .amg-sub { font-size: 0.82rem; color: var(--text2); margin-bottom: 24px; }
        .amg-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
        @media (max-width: 640px) { .amg-summary { grid-template-columns: 1fr 1fr; } }
        .amg-stat {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px; text-align: center;
        }
        .amg-stat-label { display: block; font-size: 0.68rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .amg-stat-val { font-size: 1.3rem; font-weight: 700; color: var(--text); }
        .amg-stat--green .amg-stat-val { color: #22c55e; }
        .amg-stat--red .amg-stat-val { color: #ef4444; }
        .amg-section { font-size: 0.72rem; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 12px; }
        .amg-table {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 20px;
        }
        .amg-row {
          display: grid; grid-template-columns: 2fr 1fr 1fr;
          padding: 10px 16px; border-bottom: 1px solid var(--border);
          font-size: 0.82rem; color: var(--text2); align-items: center;
        }
        .amg-row:last-child { border-bottom: none; }
        .amg-row--header { font-size: 0.7rem; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; background: var(--surface2); }
        .amg-plan-name { font-weight: 600; color: var(--text); text-transform: capitalize; }
      `}</style>
    </div>
  );
}

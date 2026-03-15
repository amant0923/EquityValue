import { useState, useEffect } from "react";
import { BellPlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const ALERT_TYPES = [
  { value: "score_change", label: "Score changes by 10+ points" },
  { value: "verdict_flip", label: "Verdict changes (e.g. Buy to Hold)" },
  { value: "score_threshold", label: "Score crosses a threshold" },
];

export default function AlertPreferences({ ticker }) {
  const { user } = useAuth();
  const [alertType, setAlertType] = useState("score_change");
  const [threshold, setThreshold] = useState(50);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    if (!user || !ticker) return;
    api.get("/alerts/subscriptions")
      .then(({ data }) => setSubs((data || []).filter(s => s.ticker === ticker)))
      .catch(() => {});
  }, [user, ticker]);

  if (!user) return null;

  const handleSubscribe = async () => {
    setSaving(true);
    try {
      await api.post("/alerts/subscribe", {
        ticker,
        alert_type: alertType,
        threshold: alertType === "score_threshold" ? threshold : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Refresh subscriptions
      const { data } = await api.get("/alerts/subscriptions");
      setSubs((data || []).filter(s => s.ticker === ticker));
    } catch {
      alert("Failed to subscribe. Please try again.");
    }
    setSaving(false);
  };

  const handleUnsubscribe = async (id) => {
    try {
      await api.delete(`/alerts/${id}`);
      setSubs(prev => prev.filter(s => s.id !== id));
    } catch {
      alert("Failed to unsubscribe.");
    }
  };

  const labelFor = (type, thresh) => {
    const match = ALERT_TYPES.find(t => t.value === type);
    let label = match ? match.label : type;
    if (type === "score_threshold" && thresh != null) label += ` (${thresh})`;
    return label;
  };

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: "12px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <BellPlus size={14} color="var(--primary)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Score Alerts for {ticker}</span>
      </div>

      {/* Active subscriptions */}
      {subs.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
            Active alerts
          </div>
          {subs.map(s => (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "5px 8px", marginBottom: 4, borderRadius: "var(--radius)",
              background: "var(--surface2)", fontSize: 12, color: "var(--text2)",
            }}>
              <span>{labelFor(s.alert_type, s.threshold)}</span>
              <button
                onClick={() => handleUnsubscribe(s.id)}
                title="Remove alert"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text3)", padding: 2, display: "flex",
                }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Subscribe form */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={alertType}
          onChange={e => setAlertType(e.target.value)}
          style={{
            background: "var(--surface2)", border: "1px solid var(--border2)",
            color: "var(--text)", padding: "6px 10px", borderRadius: "var(--radius)",
            fontSize: 12, flex: 1, minWidth: 180,
          }}
        >
          {ALERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {alertType === "score_threshold" && (
          <input
            type="number" min={0} max={100} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            style={{
              background: "var(--surface2)", border: "1px solid var(--border2)",
              color: "var(--text)", padding: "6px 10px", borderRadius: "var(--radius)",
              fontSize: 12, width: 60,
            }}
          />
        )}
        <button
          onClick={handleSubscribe}
          disabled={saving}
          style={{
            background: saved ? "#22c55e" : "var(--primary)", color: "#fff", border: "none",
            padding: "6px 14px", borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1,
          }}
        >
          {saved ? "Subscribed!" : saving ? "..." : "Add Alert"}
        </button>
      </div>
    </div>
  );
}

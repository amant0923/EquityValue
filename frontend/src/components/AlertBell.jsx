import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function AlertBell() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const unread = alerts.filter(a => !a.read).length;

  useEffect(() => {
    if (!user) return;
    api.get("/alerts/history")
      .then(({ data }) => setAlerts(data || []))
      .catch(() => setAlerts([]));
  }, [user]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markRead = async (id) => {
    try {
      await api.put(`/alerts/${id}/read`);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
    } catch {
      // Silently fail — notification state is non-critical
    }
  };

  if (!user) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none", border: "none", cursor: "pointer", color: "var(--text2)",
          position: "relative", padding: 6,
        }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: 8,
            background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, width: 320,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          zIndex: 100, maxHeight: 400, overflow: "auto",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
            Notifications
          </div>
          {alerts.length === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
              No notifications yet
            </div>
          ) : alerts.map(alert => (
            <div
              key={alert.id}
              onClick={() => !alert.read && markRead(alert.id)}
              style={{
                padding: "10px 16px", borderBottom: "1px solid var(--border)",
                cursor: alert.read ? "default" : "pointer",
                background: alert.read ? "transparent" : "rgba(37, 99, 235, 0.05)",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text)", fontWeight: alert.read ? 400 : 600 }}>
                {alert.message}
              </div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
                {new Date(alert.triggered_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

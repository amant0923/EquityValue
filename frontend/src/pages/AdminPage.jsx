import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

const PLAN_COLORS = {
  free: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", border: "rgba(148,163,184,0.3)" },
  pro:  { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6", border: "rgba(59,130,246,0.3)" },
  max:  { bg: "rgba(168,85,247,0.12)",  color: "#a855f7", border: "rgba(168,85,247,0.3)" },
};

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    checkAndLoad();
  }, []);

  async function checkAndLoad() {
    try {
      const checkRes = await api.get("/admin/check");
      if (!checkRes.data.is_admin) {
        setError("Access denied — your email is not in ADMIN_EMAILS. Check Render env vars.");
        setLoading(false);
        return;
      }
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to verify admin access");
      setLoading(false);
    }
  }

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function changePlan(userId, plan) {
    try {
      await api.patch(`/admin/users/${userId}/plan`, { plan });
      setActionMsg(`Plan updated to ${plan}`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u));
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err) {
      setActionMsg(`Error: ${err.response?.data?.detail || "Failed"}`);
    }
  }

  async function resetPassword(userId, email) {
    if (!confirm(`Send password reset email to ${email}?`)) return;
    try {
      await api.post(`/admin/users/${userId}/reset-password`);
      setActionMsg(`Reset email sent to ${email}`);
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err) {
      setActionMsg(`Error: ${err.response?.data?.detail || "Failed"}`);
    }
  }

  async function deleteUser(userId, email) {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotal(prev => prev - 1);
      setActionMsg(`Deleted ${email}`);
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err) {
      setActionMsg(`Error: ${err.response?.data?.detail || "Failed"}`);
    }
  }

  const filtered = search
    ? users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()))
    : users;

  const fmtDate = (d) => {
    if (!d) return "--";
    try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return "--"; }
  };

  const fmtTime = (d) => {
    if (!d) return "--";
    try { return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return "--"; }
  };

  const planCounts = { free: 0, pro: 0, max: 0 };
  users.forEach(u => { planCounts[u.plan] = (planCounts[u.plan] || 0) + 1; });

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div>
          <h1 className="adm-title">Admin</h1>
          <p className="adm-sub">{total} registered users</p>
        </div>
        <button className="adm-refresh" onClick={loadUsers} disabled={loading}>
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="adm-stats">
        {Object.entries(planCounts).map(([plan, count]) => {
          const c = PLAN_COLORS[plan];
          return (
            <div key={plan} className="adm-stat" style={{ background: c.bg, borderColor: c.border }}>
              <span className="adm-stat-count" style={{ color: c.color }}>{count}</span>
              <span className="adm-stat-label">{plan}</span>
            </div>
          );
        })}
      </div>

      {actionMsg && (
        <div className={`adm-toast ${actionMsg.startsWith("Error") ? "adm-toast--err" : ""}`}>
          {actionMsg}
        </div>
      )}

      {error && <div className="adm-error">{error}</div>}

      {/* Search */}
      <div className="adm-search-row">
        <input
          className="adm-search"
          placeholder="Search by email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Users table */}
      {loading ? (
        <div className="adm-loading">Loading users...</div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Plan</th>
                <th>Analyses Today</th>
                <th>Signed Up</th>
                <th>Last Sign In</th>
                <th>Confirmed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const pc = PLAN_COLORS[u.plan] || PLAN_COLORS.free;
                return (
                  <tr key={u.id}>
                    <td className="adm-email">{u.email}</td>
                    <td>
                      <span className="adm-plan-badge" style={{ color: pc.color, background: pc.bg, borderColor: pc.border }}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="mono">{u.analyses_today}</td>
                    <td>{fmtDate(u.created_at)}</td>
                    <td>{fmtTime(u.last_sign_in)}</td>
                    <td>
                      <span className={`adm-confirmed ${u.email_confirmed ? "adm-confirmed--yes" : ""}`}>
                        {u.email_confirmed ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>
                      <div className="adm-actions">
                        <select
                          className="adm-plan-select"
                          value={u.plan}
                          onChange={e => changePlan(u.id, e.target.value)}
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="max">Max</option>
                        </select>
                        <button className="adm-act-btn" onClick={() => resetPassword(u.id, u.email)} title="Send password reset email">
                          Reset PW
                        </button>
                        <button className="adm-act-btn adm-act-btn--danger" onClick={() => deleteUser(u.id, u.email)} title="Delete user">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>
                    {search ? "No users match search" : "No users found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .adm-page { max-width: 1200px; }
        .adm-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .adm-title { font-size: 1.6rem; font-weight: 700; color: var(--text); letter-spacing: -0.8px; margin-bottom: 4px; }
        .adm-sub { font-size: 0.85rem; color: var(--text3); }
        .adm-refresh {
          background: var(--surface2); color: var(--text2); border: 1px solid var(--border);
          padding: 8px 18px; border-radius: var(--radius); font-size: 0.8rem; font-weight: 600;
          cursor: pointer; font-family: inherit;
        }
        .adm-refresh:hover { background: var(--surface3); }

        .adm-stats { display: flex; gap: 12px; margin-bottom: 20px; }
        .adm-stat {
          border: 1px solid; border-radius: var(--radius); padding: 14px 24px;
          display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 90px;
        }
        .adm-stat-count { font-size: 1.5rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
        .adm-stat-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text3); }

        .adm-toast {
          background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #10b981;
          padding: 10px 18px; border-radius: var(--radius); font-size: 0.8rem; font-weight: 600; margin-bottom: 16px;
        }
        .adm-toast--err { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #ef4444; }
        .adm-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: var(--red2); padding: 14px 18px; border-radius: var(--radius); font-size: 0.8rem; margin-bottom: 16px; }

        .adm-search-row { margin-bottom: 16px; }
        .adm-search {
          width: 100%; max-width: 360px; padding: 10px 16px; border-radius: var(--radius);
          background: var(--surface); border: 1px solid var(--border); color: var(--text);
          font-size: 0.85rem; font-family: inherit; outline: none;
        }
        .adm-search:focus { border-color: var(--primary); }
        .adm-search::placeholder { color: var(--text3); }

        .adm-loading { color: var(--text3); font-size: 0.85rem; padding: 40px; text-align: center; }

        .adm-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .adm-table {
          width: 100%; border-collapse: collapse; font-size: 0.78rem;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden;
        }
        .adm-table th {
          text-align: left; font-size: 0.65rem; font-weight: 700; color: var(--text3);
          text-transform: uppercase; letter-spacing: 0.5px; padding: 12px 14px;
          border-bottom: 1px solid var(--border); background: var(--surface2); white-space: nowrap;
        }
        .adm-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text2); white-space: nowrap; }
        .adm-table tbody tr:last-child td { border-bottom: none; }
        .adm-table tbody tr:hover { background: var(--surface2); }
        .adm-email { font-weight: 600; color: var(--text); }

        .adm-plan-badge {
          font-size: 0.68rem; font-weight: 700; padding: 3px 10px; border-radius: 20px;
          border: 1px solid; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .adm-confirmed { font-size: 0.72rem; color: var(--text3); }
        .adm-confirmed--yes { color: #10b981; font-weight: 600; }

        .adm-actions { display: flex; gap: 6px; align-items: center; }
        .adm-plan-select {
          background: var(--surface2); border: 1px solid var(--border); color: var(--text);
          padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-family: inherit; cursor: pointer;
        }
        .adm-act-btn {
          background: var(--surface2); border: 1px solid var(--border); color: var(--text2);
          padding: 4px 10px; border-radius: 4px; font-size: 0.68rem; font-weight: 600;
          cursor: pointer; font-family: inherit; white-space: nowrap;
        }
        .adm-act-btn:hover { background: var(--surface3); }
        .adm-act-btn--danger { color: #ef4444; border-color: rgba(239,68,68,0.3); }
        .adm-act-btn--danger:hover { background: rgba(239,68,68,0.1); }

        @media (max-width: 768px) {
          .adm-stats { flex-wrap: wrap; }
          .adm-actions { flex-direction: column; gap: 4px; }
        }
      `}</style>
    </div>
  );
}

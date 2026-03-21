import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function ReferralPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [copying, setCopying] = useState(false);

  // TODO: [F-12] Replace with a dedicated referral_code column in user_profiles
  // to avoid leaking partial user UUID. Requires backend migration.
  const referralCode = user?.id?.slice(0, 8) || "SIGNUP";
  const referralLink = `${window.location.origin}?ref=${referralCode}`;

  useEffect(() => {
    if (!user) return;
    api.get("/referral/stats")
      .then(({ data }) => setStats(data))
      .catch(() => setStats({ referrals: 0, conversions: 0, credits_earned: 0 }));
  }, [user]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch {
      setCopying(false);
    }
  };

  return (
    <div className="ref-wrap">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="ref-title">Refer a Friend</h1>
        <p className="ref-sub">
          When someone you refer upgrades to a paid plan, you both get 1 month free.
        </p>

        <div className="ref-link-box">
          <label className="ref-label">Your referral link</label>
          <div className="ref-link-row">
            <input className="ref-link-input" value={referralLink} readOnly />
            <button className="ref-copy-btn" onClick={copyLink}>
              {copying ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="ref-how">
          <h2 className="ref-section-title">How it works</h2>
          <div className="ref-steps">
            {[
              { num: "1", title: "Share your link", desc: "Send your referral link to friends or colleagues" },
              { num: "2", title: "They sign up", desc: "Your friend creates a free account using your link" },
              { num: "3", title: "They upgrade", desc: "When they subscribe to Pro or Max, you both get 1 month free" },
            ].map(s => (
              <div key={s.num} className="ref-step">
                <span className="ref-step-num">{s.num}</span>
                <div>
                  <div className="ref-step-title">{s.title}</div>
                  <div className="ref-step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {stats && (
          <div className="ref-stats">
            <h2 className="ref-section-title">Your stats</h2>
            <div className="ref-stats-grid">
              <div className="ref-stat">
                <span className="ref-stat-val mono">{stats.referrals}</span>
                <span className="ref-stat-label">Signups</span>
              </div>
              <div className="ref-stat">
                <span className="ref-stat-val mono">{stats.conversions}</span>
                <span className="ref-stat-label">Conversions</span>
              </div>
              <div className="ref-stat">
                <span className="ref-stat-val mono">{stats.credits_earned}</span>
                <span className="ref-stat-label">Free months earned</span>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      <style>{`
        .ref-wrap { max-width: 600px; margin: 0 auto; }
        .ref-title { font-size: 1.6rem; font-weight: 700; color: var(--text); letter-spacing: -0.8px; margin-bottom: 6px; }
        .ref-sub { font-size: 0.85rem; color: var(--text2); margin-bottom: 28px; }
        .ref-link-box {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 20px; margin-bottom: 28px;
        }
        .ref-label { font-size: 0.72rem; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
        .ref-link-row { display: flex; gap: 8px; }
        .ref-link-input {
          flex: 1; background: var(--bg); border: 1px solid var(--border);
          color: var(--text); padding: 10px 14px; border-radius: 8px;
          font-size: 0.82rem; font-family: monospace;
        }
        .ref-copy-btn {
          background: var(--primary); color: #fff; border: none;
          padding: 10px 20px; border-radius: 8px;
          font-size: 0.82rem; font-weight: 700; cursor: pointer;
          font-family: inherit; white-space: nowrap;
        }
        .ref-how { margin-bottom: 28px; }
        .ref-section-title { font-size: 0.72rem; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
        .ref-steps { display: flex; flex-direction: column; gap: 16px; }
        .ref-step { display: flex; gap: 14px; align-items: flex-start; }
        .ref-step-num {
          width: 28px; height: 28px; border-radius: 14px;
          background: var(--primary-glow2); color: var(--primary2);
          font-size: 0.78rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ref-step-title { font-size: 0.88rem; font-weight: 700; color: var(--text); margin-bottom: 2px; }
        .ref-step-desc { font-size: 0.78rem; color: var(--text2); }
        .ref-stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .ref-stat {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px; text-align: center;
        }
        .ref-stat-val { font-size: 1.4rem; font-weight: 700; color: var(--text); display: block; }
        .ref-stat-label { font-size: 0.72rem; color: var(--text3); }
      `}</style>
    </div>
  );
}

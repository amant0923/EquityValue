import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const PLANS = [
  {
    name: "Pro",
    price: "$15",
    period: "/month",
    limit: "Unlimited analyses",
    priceEnv: "pro",
    features: ["Unlimited analyses", "All 12 valuation models", "AI investment thesis (Claude)", "Monte Carlo simulation", "LBO return modelling", "PDF report export", "Compare stocks side-by-side", "Full screener with all filters", "EVS score history & trends", "Quarterly financial statements"],
    cta: "Get Pro",
    color: "var(--primary)",
    featured: true,
  },
];

export default function UpgradeModal({ onClose, reason = "limit", currentPlan = "trial", onShowAuth }) {
  const { user } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [lifetimeStatus, setLifetimeStatus] = useState(null);
  const [showStudent, setShowStudent] = useState(false);
  const [studentEmail, setStudentEmail] = useState("");
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    api.get("/pricing/lifetime/status")
      .then(({ data }) => setLifetimeStatus(data))
      .catch(() => {});
  }, []);

  const handleUpgrade = async (planKey) => {
    if (!user) {
      setCheckoutError("Please sign in first to upgrade your plan.");
      return;
    }
    setUpgrading(true);
    try {
      const res = await api.post("/stripe/create-checkout", { plan: planKey });
      const url = res.data.checkout_url;
      if (url && (url.startsWith("https://checkout.stripe.com/") || url.startsWith("https://billing.stripe.com/"))) {
        window.location.href = url;
      } else if (url) {
        if (import.meta.env.DEV) console.error("Invalid checkout URL");
        setCheckoutError("Invalid checkout URL received. Please try again.");
        setUpgrading(false);
      } else {
        setCheckoutError(res.data?.detail || "Could not start checkout. Please try again.");
        setUpgrading(false);
      }
    } catch (err) {
      const detail = err.response?.data?.detail
        || (typeof err.response?.data === "string" && err.response.data.slice(0, 200))
        || err.message;
      console.error("Stripe checkout error:", err.response?.status, err.response?.data, err.message);
      setCheckoutError(detail || "Could not connect to payment server. Please try again.");
      setUpgrading(false);
    }
  };
  return (
    <motion.div
      className="upg-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="upg-modal"
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <button className="upg-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="upg-header">
          <h2 className="upg-title">
            {reason === "guest_limit"
              ? "Create a free account"
              : reason === "limit" && currentPlan === "expired"
              ? "Your trial has ended"
              : reason === "limit"
              ? "Daily limit reached"
              : "Upgrade to unlock"}
          </h2>
          <p className="upg-sub">
            {reason === "guest_limit"
              ? "Sign up for a free 14-day trial — 3 analyses per day, AI thesis, and more."
              : reason === "limit" && currentPlan === "expired"
              ? "Your 14-day trial has ended. Upgrade to Pro to continue analysing stocks."
              : reason === "limit"
              ? "You've used your analyses for today. Upgrade for unlimited access."
              : "This feature is available on the Pro plan."}
          </p>
          {reason !== "guest_limit" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 }}>
              <span style={{ fontSize: 13, color: annual ? "var(--text3)" : "var(--text)", fontWeight: annual ? 400 : 600 }}>Monthly</span>
              <button
                onClick={() => setAnnual(!annual)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none",
                  background: annual ? "var(--primary)" : "var(--border)",
                  position: "relative", cursor: "pointer", transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 9, background: "#fff",
                  position: "absolute", top: 3, left: annual ? 23 : 3, transition: "left 0.2s",
                }} />
              </button>
              <span style={{ fontSize: 13, color: annual ? "var(--text)" : "var(--text3)", fontWeight: annual ? 600 : 400 }}>
                Annual <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700 }}>Save 20%</span>
              </span>
            </div>
          )}
        </div>

        {reason === "guest_limit" && !user && (
          <div className="upg-guest-cta">
            <div className="upg-guest-features">
              <div className="upg-guest-feature">14-day free trial</div>
              <div className="upg-guest-feature">3 analyses per day</div>
              <div className="upg-guest-feature">AI investment thesis included</div>
              <div className="upg-guest-feature">No credit card required</div>
            </div>
            <button
              className="upg-plan-cta"
              style={{ background: "var(--primary)", maxWidth: 340, width: "100%", margin: "0 auto" }}
              onClick={() => { onClose(); if (onShowAuth) onShowAuth("signup"); }}
            >
              Create Free Account
            </button>
            <p style={{ fontSize: "0.72rem", color: "var(--text3)", textAlign: "center", marginTop: 12 }}>
              Already have an account?{" "}
              <button
                style={{ background: "none", border: "none", color: "var(--primary2)", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline", padding: 0 }}
                onClick={() => { onClose(); if (onShowAuth) onShowAuth("login"); }}
              >
                Log in
              </button>
            </p>
            <style>{`
              .upg-guest-cta { display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; }
              .upg-guest-features { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 20px; }
              .upg-guest-feature {
                font-size: 0.75rem; color: var(--text2); padding: 6px 14px;
                background: rgba(129,140,248,0.06); border: 1px solid rgba(129,140,248,0.15);
                border-radius: 20px;
              }
            `}</style>
          </div>
        )}

        {reason !== "guest_limit" && <div className="upg-plans">
          {PLANS.map((plan, i) => (
            <div key={i} className={`upg-plan${plan.featured ? " upg-plan--featured" : ""}`}>
              <div className="upg-plan-name">{plan.name}</div>
              <div className="upg-plan-price">
                <span className="upg-plan-amount mono">
                  {annual ? "$12" : plan.price}
                </span>
                <span className="upg-plan-period">{plan.period}</span>
              </div>
              {annual && (
                <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: -4 }}>
                  billed annually
                </div>
              )}
              <div className="upg-plan-limit">{plan.limit}</div>
              <ul className="upg-plan-features">
                {plan.features.map((f, j) => (
                  <li key={j}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="upg-plan-cta"
                style={{ background: plan.color }}
                onClick={() => handleUpgrade(annual ? `${plan.priceEnv}_annual` : plan.priceEnv)}
                disabled={upgrading}
              >
                {upgrading ? "Redirecting..." : plan.cta}
              </button>
            </div>
          ))}
        </div>}

        {/* Lifetime Deal — only show for logged-in users, not guests */}
        {reason !== "guest_limit" && lifetimeStatus?.available && (
          <div className="upg-lifetime">
            <div className="upg-lifetime-badge">Limited Offer</div>
            <div className="upg-lifetime-title">Founding Pro — $99 lifetime</div>
            <div className="upg-lifetime-desc">
              One-time payment. Permanent Pro access. {lifetimeStatus.remaining} of {lifetimeStatus.total} remaining.
            </div>
            <button
              className="upg-lifetime-cta"
              onClick={async () => {
                setUpgrading(true);
                setCheckoutError("");
                try {
                  const res = await api.post("/pricing/lifetime/checkout");
                  const ltUrl = res.data.checkout_url;
                  if (ltUrl && (ltUrl.startsWith("https://checkout.stripe.com/") || ltUrl.startsWith("https://billing.stripe.com/"))) window.location.href = ltUrl;
                  else { setCheckoutError(ltUrl ? "Invalid checkout URL received." : "Could not start checkout."); setUpgrading(false); }
                } catch (err) { setCheckoutError(err.response?.data?.detail || "Could not connect to payment server."); setUpgrading(false); }
              }}
              disabled={upgrading}
            >
              {upgrading ? "Redirecting..." : "Get Lifetime Pro — $99"}
            </button>
          </div>
        )}

        {/* Student Discount — only for logged-in users */}
        {reason !== "guest_limit" && <div className="upg-student">
          {!showStudent ? (
            <button className="upg-student-toggle" onClick={() => setShowStudent(true)}>
              Student? Get 50% off
            </button>
          ) : (
            <div className="upg-student-form">
              <p className="upg-student-desc">Enter your .edu email to verify student status</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="upg-student-input"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="you@university.edu"
                />
                <button
                  className="upg-student-btn"
                  onClick={async () => {
                    setUpgrading(true);
                    setCheckoutError("");
                    try {
                      await api.post("/pricing/student/verify", { email: studentEmail });
                      const res = await api.post("/pricing/student/checkout", { plan: "pro" });
                      const stuUrl = res.data.checkout_url;
                      if (stuUrl && (stuUrl.startsWith("https://checkout.stripe.com/") || stuUrl.startsWith("https://billing.stripe.com/"))) window.location.href = stuUrl;
                      else { setCheckoutError(stuUrl ? "Invalid checkout URL received." : "Could not start checkout."); setUpgrading(false); }
                    } catch (e) {
                      setCheckoutError(e.response?.data?.detail || "Verification failed. Must be a .edu email.");
                      setUpgrading(false);
                    }
                  }}
                  disabled={!studentEmail.endsWith(".edu")}
                >
                  Verify & Checkout
                </button>
              </div>
            </div>
          )}
        </div>}

        {checkoutError && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444", padding: "10px 14px", borderRadius: "var(--radius)",
            fontSize: "0.78rem", textAlign: "center", marginBottom: 12,
          }}>
            {checkoutError}
          </div>
        )}
        <p className="upg-note">Secure payment via Stripe. Cancel anytime.</p>
      </motion.div>

      <style>{`
        .upg-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .upg-modal {
          background: var(--surface);
          border: 1px solid var(--border2);
          border-radius: var(--radius-xl);
          max-width: 600px; width: 100%;
          padding: 36px;
          position: relative;
        }
        .upg-close {
          position: absolute;
          top: 16px; right: 16px;
          background: transparent;
          border: none;
          color: var(--text3);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.2s;
        }
        .upg-close:hover { color: var(--text); }

        .upg-header { text-align: center; margin-bottom: 28px; }
        .upg-title { font-size: 1.2rem; font-weight: 700; color: var(--text); margin-bottom: 8px; }
        .upg-sub { font-size: 0.82rem; color: var(--text2); }

        .upg-plans { display: flex; justify-content: center; margin-bottom: 20px; }
        .upg-plan {
          max-width: 340px;
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .upg-plan--featured {
          border-color: rgba(129,140,248,0.35);
          background: rgba(129,140,248,0.04);
        }
        .upg-plan-name {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 1px;
          text-transform: uppercase; color: var(--text3);
        }
        .upg-plan-price { display: flex; align-items: baseline; gap: 2px; }
        .upg-plan-amount { font-size: 2rem; font-weight: 700; color: var(--text); letter-spacing: -1px; }
        .upg-plan-period { font-size: 0.82rem; color: var(--text3); }
        .upg-plan-limit {
          font-size: 0.78rem; font-weight: 600; color: var(--primary2);
          margin-bottom: 8px;
        }
        .upg-plan-features {
          list-style: none; display: flex; flex-direction: column; gap: 6px;
          margin-bottom: 16px; flex: 1;
        }
        .upg-plan-features li {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.78rem; color: var(--text2);
        }
        .upg-plan-cta {
          width: 100%;
          color: #fff;
          border: none;
          padding: 10px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .upg-plan-cta:hover { opacity: 0.88; }

        .upg-lifetime {
          background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(129,140,248,0.08));
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: var(--radius-lg);
          padding: 16px;
          text-align: center;
          margin-bottom: 16px;
          position: relative;
        }
        .upg-lifetime-badge {
          position: absolute; top: -8px; right: 16px;
          background: #f59e0b; color: #000; font-size: 0.6rem;
          font-weight: 800; padding: 2px 8px; border-radius: 4px;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .upg-lifetime-title { font-size: 0.95rem; font-weight: 700; color: var(--text); margin-bottom: 4px; }
        .upg-lifetime-desc { font-size: 0.75rem; color: var(--text2); margin-bottom: 12px; }
        .upg-lifetime-cta {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #000; border: none; padding: 10px 24px;
          border-radius: var(--radius); font-weight: 700; font-size: 0.85rem;
          cursor: pointer; font-family: inherit; transition: opacity 0.2s;
        }
        .upg-lifetime-cta:hover { opacity: 0.88; }

        .upg-student { text-align: center; margin-bottom: 12px; }
        .upg-student-toggle {
          background: none; border: none; color: var(--primary2);
          font-size: 0.78rem; font-weight: 600; cursor: pointer;
          font-family: inherit; text-decoration: underline;
        }
        .upg-student-form { text-align: left; }
        .upg-student-desc { font-size: 0.75rem; color: var(--text3); margin-bottom: 8px; }
        .upg-student-input {
          flex: 1; background: var(--surface2); border: 1px solid var(--border);
          color: var(--text); padding: 8px 12px; border-radius: 6px;
          font-size: 0.78rem; font-family: inherit;
        }
        .upg-student-btn {
          background: var(--primary); color: #fff; border: none;
          padding: 8px 16px; border-radius: 6px; font-weight: 700;
          font-size: 0.75rem; cursor: pointer; font-family: inherit;
          white-space: nowrap;
        }
        .upg-student-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .upg-note {
          text-align: center;
          font-size: 0.72rem;
          color: var(--text3);
        }

        @media (max-width: 540px) {
          .upg-plans { grid-template-columns: 1fr; }
          .upg-modal { padding: 24px 20px; }
        }
      `}</style>
    </motion.div>
  );
}

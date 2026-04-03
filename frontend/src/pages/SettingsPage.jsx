import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function SettingsPage() {
  const { profile } = useAuth();
  const [subStatus, setSubStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const res = await api.get("/stripe/subscription-status");
      setSubStatus(res.data);
    } catch (err) {
      setError("Failed to load subscription details");
    } finally {
      setLoading(false);
    }
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await api.post("/stripe/billing-portal");
      const url = res.data.portal_url;
      if (url && (url.startsWith("https://billing.stripe.com/") || url.startsWith("https://checkout.stripe.com/"))) {
        window.location.href = url;
      } else {
        setError("Invalid billing portal URL");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const planColors = {
    trial: "#f59e0b",
    expired: "#ef4444",
    pro: "#8b5cf6",
    lifetime: "#10b981",
  };

  const formatDate = (unix) => {
    if (!unix) return null;
    return new Date(unix * 1000).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  };

  const plan = subStatus?.plan || profile?.plan || "trial";
  const planColor = planColors[plan] || "#888";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Settings</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 32 }}>Manage your account and billing</p>

      <div style={{
        background: "var(--card-bg, #1a1a2e)",
        border: "1px solid var(--border, #2a2a3e)",
        borderRadius: 12,
        padding: 28,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: "var(--text)" }}>Billing</h2>

        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading subscription details...</div>
        ) : error ? (
          <div style={{ color: "#ef4444", fontSize: 14 }}>{error}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Current Plan</span>
              <span style={{
                background: planColor + "22",
                color: planColor,
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                textTransform: "capitalize",
              }}>{plan}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Status</span>
              <span style={{ color: "var(--text)", fontSize: 14 }}>
                {subStatus?.cancel_at_period_end
                  ? "Cancelling at period end"
                  : subStatus?.status === "past_due"
                  ? "Past due"
                  : subStatus?.status === "active"
                  ? "Active"
                  : plan === "trial"
                  ? "Trial"
                  : plan === "lifetime"
                  ? "Lifetime (never expires)"
                  : plan === "expired"
                  ? "Expired"
                  : subStatus?.status || "\u2014"}
              </span>
            </div>

            {subStatus?.current_period_end && plan === "pro" && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  {subStatus.cancel_at_period_end ? "Access until" : "Next billing date"}
                </span>
                <span style={{ color: "var(--text)", fontSize: 14 }}>
                  {formatDate(subStatus.current_period_end)}
                </span>
              </div>
            )}

            {subStatus?.payment_method_last4 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Payment method</span>
                <span style={{ color: "var(--text)", fontSize: 14, fontFamily: "monospace" }}>
                  **** {subStatus.payment_method_last4}
                </span>
              </div>
            )}

            {subStatus?.payment_failed && (
              <div style={{
                background: "#ef444422",
                border: "1px solid #ef4444",
                borderRadius: 8,
                padding: "12px 16px",
                color: "#ef4444",
                fontSize: 13,
                marginTop: 4,
              }}>
                Your last payment failed. Please update your payment method to keep your Pro access.
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {(plan === "pro" || subStatus?.payment_method_last4) && (
                <button
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor: portalLoading ? "wait" : "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    opacity: portalLoading ? 0.6 : 1,
                  }}
                >
                  {portalLoading ? "Opening..." : "Manage Subscription"}
                </button>
              )}

              {(plan === "trial" || plan === "expired") && (
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("show-upgrade", { detail: { reason: "feature" } }));
                  }}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--accent, #8b5cf6)",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

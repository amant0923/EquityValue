# Stripe Full Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Stripe integration with billing portal, subscription status, payment confirmation UX, failed payment handling, and a settings page.

**Architecture:** Backend adds 3 endpoints (billing-portal, subscription-status, expanded webhooks) + 1 DB column. Frontend adds SettingsPage, payment confirmation flow, and failed payment banner.

**Tech Stack:** FastAPI, stripe Python SDK, React, Supabase, axios

**Spec:** `docs/superpowers/specs/2026-04-03-stripe-full-integration-design.md`

---

### Task 1: Add `payment_failed` column to user_profiles

**Files:**
- Create: `backend/migrations/007_payment_failed.sql`

- [ ] **Step 1: Write the migration SQL**

Create `backend/migrations/007_payment_failed.sql`:

```sql
-- Add payment_failed flag for failed payment banner
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 2: Run the migration against Supabase**

Run via Supabase SQL editor or CLI:
```bash
cd backend && python3 -c "
from config import SUPABASE_URL, SUPABASE_KEY
import os
from supabase import create_client
sb = create_client(SUPABASE_URL, os.environ.get('SUPABASE_SERVICE_KEY', SUPABASE_KEY))
sb.postgrest.schema('public')
# Run raw SQL via rpc or SQL editor
print('Run this SQL in Supabase SQL Editor:')
print('ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN NOT NULL DEFAULT FALSE;')
"
```

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/007_payment_failed.sql
git commit -m "feat: add payment_failed column migration"
```

---

### Task 2: Add billing portal endpoint

**Files:**
- Modify: `backend/main.py` (after the existing `/stripe/webhook` endpoint, around line 895)

- [ ] **Step 1: Add the billing portal endpoint**

Add after the existing webhook endpoint (after line 895 in `main.py`):

```python
@app.post("/stripe/billing-portal")
@limiter.limit("5/minute")
async def create_billing_portal(request: Request, user: dict = Depends(get_current_user)):
    """Create a Stripe Billing Portal session for subscription management."""
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    if not _supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    # Look up stripe_customer_id
    result = _supabase.table("user_profiles").select("stripe_customer_id").eq("id", user["sub"]).single().execute()
    customer_id = (result.data or {}).get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url="https://equityvalue.ai/settings",
        )
        return {"portal_url": session.url}
    except Exception as e:
        logger.error("Billing portal error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create billing portal session") from None
```

- [ ] **Step 2: Verify the server starts**

```bash
cd backend && python3 -c "from main import app; print('OK')"
```
Expected: `OK` (no import errors)

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add Stripe billing portal endpoint"
```

---

### Task 3: Add subscription status endpoint

**Files:**
- Modify: `backend/main.py` (after the billing portal endpoint)

- [ ] **Step 1: Add the subscription status endpoint**

Add after the billing portal endpoint:

```python
@app.get("/stripe/subscription-status")
@limiter.limit("10/minute")
async def subscription_status(request: Request, user: dict = Depends(get_current_user)):
    """Return current subscription details for the authenticated user."""
    if not _supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    result = _supabase.table("user_profiles").select("plan, stripe_customer_id, payment_failed").eq("id", user["sub"]).single().execute()
    profile = result.data or {}
    plan = profile.get("plan", "trial")
    customer_id = profile.get("stripe_customer_id")
    payment_failed = profile.get("payment_failed", False)

    base = {
        "plan": plan,
        "status": "active" if plan in ("pro", "lifetime") else plan,
        "current_period_end": None,
        "cancel_at_period_end": False,
        "payment_method_last4": None,
        "payment_failed": payment_failed,
    }

    # For non-Stripe plans (trial, expired, lifetime), return DB-only info
    if not customer_id or not stripe.api_key:
        return base

    try:
        subs = stripe.Subscription.list(customer=customer_id, limit=1)
        if subs.data:
            sub = subs.data[0]
            base["status"] = sub.status
            base["current_period_end"] = sub.current_period_end
            base["cancel_at_period_end"] = sub.cancel_at_period_end

            # Get payment method last4
            default_pm = sub.default_payment_method
            if default_pm:
                if isinstance(default_pm, str):
                    pm = stripe.PaymentMethod.retrieve(default_pm)
                else:
                    pm = default_pm
                if pm.card:
                    base["payment_method_last4"] = pm.card.last4
    except Exception as e:
        logger.error("Subscription status lookup error: %s", e)
        # Return base info without Stripe details on error

    return base
```

- [ ] **Step 2: Verify the server starts**

```bash
cd backend && python3 -c "from main import app; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add subscription status endpoint"
```

---

### Task 4: Expand webhook handler with new events

**Files:**
- Modify: `backend/main.py` (the existing `stripe_webhook` function, lines 859-895)

- [ ] **Step 1: Replace the webhook handler's try block**

In `backend/main.py`, find the existing webhook try block (lines 870-895). Replace the entire `try:` block inside `stripe_webhook` (after `event = handle_webhook_event(...)`) with:

```python
    try:
        event_type = event["type"]
        event_obj = event["data"]["object"]

        if event_type == "checkout.session.completed":
            metadata = event_obj.get("metadata") or {}
            user_id = metadata.get("user_id")
            subscription_id = event_obj.get("subscription")
            if not user_id or not subscription_id:
                raise HTTPException(status_code=400, detail="Malformed webhook: missing metadata or subscription")
            subscription = stripe.Subscription.retrieve(subscription_id)
            price_id = subscription["items"]["data"][0]["price"]["id"]
            plan = price_id_to_plan(price_id)
            _supabase.table("user_profiles").update({
                "plan": plan,
                "stripe_customer_id": event_obj.get("customer", ""),
                "payment_failed": False,
            }).eq("id", user_id).execute()

        elif event_type == "customer.subscription.deleted":
            customer_id = event_obj.get("customer")
            if customer_id:
                _supabase.table("user_profiles").update({"plan": "expired"}).eq("stripe_customer_id", customer_id).execute()

        elif event_type == "customer.subscription.updated":
            customer_id = event_obj.get("customer")
            if customer_id and event_obj.get("items", {}).get("data"):
                price_id = event_obj["items"]["data"][0]["price"]["id"]
                plan = price_id_to_plan(price_id)
                status = event_obj.get("status", "")
                if status in ("canceled", "unpaid"):
                    plan = "expired"
                _supabase.table("user_profiles").update({"plan": plan}).eq("stripe_customer_id", customer_id).execute()

        elif event_type == "invoice.payment_failed":
            customer_id = event_obj.get("customer")
            if customer_id:
                _supabase.table("user_profiles").update({"payment_failed": True}).eq("stripe_customer_id", customer_id).execute()

        elif event_type == "invoice.payment_succeeded":
            customer_id = event_obj.get("customer")
            if customer_id:
                _supabase.table("user_profiles").update({"payment_failed": False}).eq("stripe_customer_id", customer_id).execute()

    except Exception as e:
        import logging as _logging
        _logging.getLogger(__name__).error(f"Webhook processing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Webhook processing failed") from None
```

- [ ] **Step 2: Verify the server starts**

```bash
cd backend && python3 -c "from main import app; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: handle invoice.payment_failed/succeeded and subscription.updated webhooks"
```

---

### Task 5: Update AuthContext to expose payment_failed and refreshProfile

**Files:**
- Modify: `frontend/src/context/AuthContext.jsx`

- [ ] **Step 1: Add refreshProfile to the context**

In `AuthContext.jsx`, add `refreshProfile` function after the `trialInfo` function (after line 200):

```javascript
  const refreshProfile = async () => {
    if (!supabase || !user) return;
    const p = await fetchProfile(user.id);
    setProfile(p);
  };
```

- [ ] **Step 2: Add payment_failed to the effective profile**

In the `getEffectiveProfile` function (around line 47), add `payment_failed` to the returned object. Find the return statement at line 64:

```javascript
    return { ...p, plan, analyses_today: count, analyses_total: p.analyses_total || 0, limit: planInfo.limit, planLabel: planInfo.label };
```

Replace with:

```javascript
    return { ...p, plan, analyses_today: count, analyses_total: p.analyses_total || 0, limit: planInfo.limit, planLabel: planInfo.label, payment_failed: !!p.payment_failed };
```

- [ ] **Step 3: Expose refreshProfile in the context value**

In the `value` object (around line 202), add `refreshProfile`:

```javascript
  const value = {
    user,
    profile: profile ? getEffectiveProfile(profile) : null,
    loading,
    signUp,
    signIn,
    signOut,
    recordAnalysis,
    canAnalyse,
    isFeatureUnlocked,
    getLimit,
    getToken,
    trialInfo,
    refreshProfile,
  };
```

- [ ] **Step 4: Verify the app compiles**

```bash
cd frontend && npx vite build --mode development 2>&1 | tail -5
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/AuthContext.jsx
git commit -m "feat: expose payment_failed and refreshProfile in AuthContext"
```

---

### Task 6: Add payment success/cancel handling in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add payment query param handling**

In `App.jsx`, inside the `AppInner` function, find the existing `useEffect` that handles URL params (around line 116-140). Add a new `useEffect` after it:

```javascript
  // Handle Stripe payment redirect
  const [paymentToast, setPaymentToast] = useState(null);
  const { refreshProfile } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (!payment) return;

    if (payment === "success") {
      setPaymentToast("success");
      // Poll for plan update (webhook may be async)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await refreshProfile();
        if (attempts >= 5) clearInterval(poll);
      }, 2000);
      // Clean up
      setTimeout(() => clearInterval(poll), 12000);
    } else if (payment === "cancelled") {
      setPaymentToast("cancelled");
    }

    // Remove query param from URL
    params.delete("payment");
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params}`
      : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, []);
```

Note: also add `refreshProfile` to the destructured `useAuth()` call on line 93. Change:
```javascript
  const { user, profile, loading: authLoading, signOut, recordAnalysis, canAnalyse, isFeatureUnlocked } = useAuth();
```
to:
```javascript
  const { user, profile, loading: authLoading, signOut, recordAnalysis, canAnalyse, isFeatureUnlocked, refreshProfile } = useAuth();
```

- [ ] **Step 2: Add the toast UI**

In the JSX return of `AppInner` (around line 224), add the payment toast just before the `<Suspense>`:

```jsx
      {paymentToast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 10000, padding: "14px 28px", borderRadius: 10,
          background: paymentToast === "success" ? "var(--green, #22c55e)" : "var(--text-muted, #888)",
          color: "#fff", fontWeight: 600, fontSize: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          {paymentToast === "success" ? "You're now on Pro! Welcome aboard." : "Payment cancelled."}
          <button onClick={() => setPaymentToast(null)} style={{
            background: "none", border: "none", color: "#fff", cursor: "pointer",
            fontSize: 18, lineHeight: 1, padding: 0, marginLeft: 8,
          }}>&times;</button>
        </div>
      )}
```

- [ ] **Step 3: Auto-dismiss toast after 8 seconds**

Add inside the payment `useEffect`, at the end (before the closing `}`):

```javascript
    // Auto-dismiss after 8 seconds
    setTimeout(() => setPaymentToast(null), 8000);
```

- [ ] **Step 4: Verify the app compiles**

```bash
cd frontend && npx vite build --mode development 2>&1 | tail -5
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: handle payment success/cancel redirects with toast"
```

---

### Task 7: Add SettingsPage with billing section

**Files:**
- Create: `frontend/src/pages/SettingsPage.jsx`

- [ ] **Step 1: Create the SettingsPage component**

Create `frontend/src/pages/SettingsPage.jsx`:

```jsx
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

      {/* Billing Section */}
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
            {/* Plan */}
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

            {/* Status */}
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
                  : subStatus?.status || "—"}
              </span>
            </div>

            {/* Next billing date */}
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

            {/* Payment method */}
            {subStatus?.payment_method_last4 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Payment method</span>
                <span style={{ color: "var(--text)", fontSize: 14, fontFamily: "monospace" }}>
                  **** {subStatus.payment_method_last4}
                </span>
              </div>
            )}

            {/* Failed payment warning */}
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

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {(plan === "pro" || subStatus?.stripe_customer_id || subStatus?.payment_method_last4) && (
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
                    // Dispatch event for UpgradeModal — AppLayout listens via Outlet context
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
```

- [ ] **Step 2: Verify the component has no syntax errors**

```bash
cd frontend && npx vite build --mode development 2>&1 | tail -5
```
Expected: no errors (component is tree-shaken since not routed yet)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/SettingsPage.jsx
git commit -m "feat: add SettingsPage with billing section"
```

---

### Task 8: Wire up settings route and navigation

**Files:**
- Modify: `frontend/src/App.jsx` (add route)
- Modify: `frontend/src/components/Sidebar.jsx` (add nav item)
- Modify: `frontend/src/layouts/AppLayout.jsx` (add settings to handlePageChange)

- [ ] **Step 1: Add lazy import and route in App.jsx**

In `App.jsx`, add the lazy import after the other lazy imports (around line 55):

```javascript
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
```

Add the route inside the `<Route element={<AppLayout />}>` block, before the admin route (around line 322):

```jsx
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
```

- [ ] **Step 2: Add settings to Sidebar nav**

In `frontend/src/components/Sidebar.jsx`, add a "Settings" entry to the `NAV` array, before the "Help" entry:

```javascript
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
```

- [ ] **Step 3: Add settings to handlePageChange routes**

In `frontend/src/layouts/AppLayout.jsx`, add `settings: "/settings"` to the `routes` object in `handlePageChange` (around line 37):

```javascript
    const routes = {
      dashboard: "/dashboard",
      screener: "/screener",
      compare: "/compare",
      analysis: "/analysis",
      portfolio: "/portfolio",
      blog: "/blog",
      referral: "/referral",
      help: "/help",
      settings: "/settings",
    };
```

Also add "Settings" to the breadcrumb map (line 69):

```javascript
                {{ dashboard: "Dashboard", screener: "Screener", compare: "Compare", company: "Company", analysis: "Analysis", portfolio: "Portfolio", blog: "Blog", referral: "Refer a Friend", help: "Help", admin: "Admin", settings: "Settings" }[currentPage] || currentPage}
```

- [ ] **Step 4: Verify the app compiles**

```bash
cd frontend && npx vite build --mode development 2>&1 | tail -5
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/Sidebar.jsx frontend/src/layouts/AppLayout.jsx
git commit -m "feat: wire settings route and sidebar navigation"
```

---

### Task 9: Add failed payment banner to AppLayout

**Files:**
- Modify: `frontend/src/layouts/AppLayout.jsx`

- [ ] **Step 1: Add the failed payment banner**

In `AppLayout.jsx`, add after the topbar `<header>` closing tag (after line 118) and before `<MobileNav`:

```jsx
          {profile?.payment_failed && (
            <div style={{
              background: "#f59e0b22",
              border: "1px solid #f59e0b",
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 13,
              color: "#f59e0b",
            }}>
              <span>Your last payment failed. Please update your payment method to keep your Pro access.</span>
              <button
                onClick={async () => {
                  try {
                    const res = await api.post("/stripe/billing-portal");
                    const url = res.data.portal_url;
                    if (url) window.location.href = url;
                  } catch {}
                }}
                style={{
                  background: "#f59e0b",
                  color: "#000",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  marginLeft: 16,
                }}
              >
                Update Payment
              </button>
            </div>
          )}
```

- [ ] **Step 2: Add api import**

At the top of `AppLayout.jsx`, add the api import (if not already present):

```javascript
import api from "../lib/api";
```

- [ ] **Step 3: Verify the app compiles**

```bash
cd frontend && npx vite build --mode development 2>&1 | tail -5
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/layouts/AppLayout.jsx
git commit -m "feat: add failed payment warning banner in AppLayout"
```

---

### Task 10: Add upgrade modal trigger from SettingsPage

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx`
- Modify: `frontend/src/layouts/AppLayout.jsx`

- [ ] **Step 1: Listen for upgrade event in AppLayout**

In `AppLayout.jsx`, add a `useEffect` inside the component (after the existing state declarations, around line 23):

```javascript
  useEffect(() => {
    const handler = (e) => {
      setUpgradeReason(e.detail?.reason || "feature");
      setShowUpgrade(true);
    };
    window.addEventListener("show-upgrade", handler);
    return () => window.removeEventListener("show-upgrade", handler);
  }, []);
```

Note: `useEffect` import should already be present. Check the imports at the top of AppLayout.jsx — add it if missing:

```javascript
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
```

- [ ] **Step 2: Verify the app compiles**

```bash
cd frontend && npx vite build --mode development 2>&1 | tail -5
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/layouts/AppLayout.jsx
git commit -m "feat: handle show-upgrade custom event in AppLayout"
```

---

### Task 11: Final verification and push

- [ ] **Step 1: Verify backend starts**

```bash
cd backend && python3 -c "from main import app; print('Backend OK')"
```
Expected: `Backend OK`

- [ ] **Step 2: Verify frontend builds**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```
Expected: build succeeds

- [ ] **Step 3: Push all commits**

```bash
git push origin main
```

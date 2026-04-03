# Stripe Full Integration Design

**Date:** 2026-04-03
**Status:** Approved

## Overview

Complete the Stripe integration for the stock valuation app. The core checkout flow, webhooks, and plan management already exist. This spec covers the remaining gaps: payment confirmation UX, billing portal, subscription management, failed payment handling, and a new settings page.

## 1. Payment Success/Cancel Handling

**Location:** `frontend/src/App.jsx`

When users return from Stripe checkout, read `?payment=success` or `?payment=cancelled` query params from the URL.

**Success flow:**
- Show a toast/banner: "You're now on Pro!"
- Poll the auth context (re-fetch `user_profiles`) every 2 seconds for up to 10 seconds until the plan field updates (webhook may be async)
- Clear the query param from the URL via `window.history.replaceState`

**Cancel flow:**
- Show a dismissible message: "Payment cancelled"
- Clear the query param

## 2. Stripe Billing Portal Endpoint

**Endpoint:** `POST /stripe/billing-portal`
**Auth:** Required (JWT)
**File:** `backend/main.py` (add alongside existing Stripe endpoints)

Flow:
1. Get authenticated user's `stripe_customer_id` from `user_profiles`
2. If no customer ID → return 400 "No active subscription"
3. Call `stripe.billing_portal.Session.create(customer=customer_id, return_url="https://equityvalue.ai/settings")`
4. Return `{"portal_url": session.url}`

Stripe's hosted portal handles: update payment method, cancel subscription, view invoices, download receipts.

**Prerequisite:** Enable Customer Portal in Stripe Dashboard (Settings → Billing → Customer Portal).

## 3. Subscription Status Endpoint

**Endpoint:** `GET /stripe/subscription-status`
**Auth:** Required (JWT)
**File:** `backend/main.py`

Returns current subscription details for the authenticated user:

```json
{
  "plan": "pro",
  "status": "active",
  "current_period_end": "2026-05-03T00:00:00Z",
  "cancel_at_period_end": false,
  "payment_method_last4": "4242",
  "payment_failed": false
}
```

Logic:
- Look up `stripe_customer_id` from `user_profiles`
- If no customer ID (trial/lifetime/free): return plan info from DB only, no Stripe call
- If customer ID exists: call `stripe.Subscription.list(customer=customer_id, limit=1)`, extract status, period end, cancellation flag
- Get default payment method from subscription for last4
- Include `payment_failed` flag from DB

## 4. Settings Page with Billing Section

**Route:** `/settings`
**Component:** `frontend/src/pages/SettingsPage.jsx`
**Nav:** Add "Settings" link to user menu/nav

Billing section shows:
- **Plan badge:** Trial / Pro / Lifetime with colored badge
- **Status:** Active, Cancelling (cancel_at_period_end), Past Due
- **Next billing date:** formatted from `current_period_end` (hidden for trial/lifetime)
- **Payment method:** Card icon + last 4 digits (hidden for trial/lifetime)
- **"Manage Subscription" button:** Opens Stripe Billing Portal (hidden for trial/lifetime)
- **"Upgrade" button:** Opens UpgradeModal (shown for trial/expired users)

## 5. Additional Webhook Events

**File:** `backend/main.py` (expand existing webhook handler)

### `invoice.payment_failed`
- Extract `customer` ID from event
- Look up user by `stripe_customer_id` in `user_profiles`
- Set `payment_failed = true` on the user's profile
- Do NOT downgrade the plan (Stripe retries automatically over ~2 weeks)

### `invoice.payment_succeeded`
- Extract `customer` ID from event
- Clear `payment_failed = false` on the user's profile
- This handles successful retries after a failure

### `customer.subscription.updated`
- Extract subscription object from event
- Get `customer` ID and look up user
- Sync plan: map the subscription's price ID back to plan name
- If `status == "canceled"` or subscription is empty, set plan to "expired"
- Handle downgrade/upgrade scenarios from Billing Portal

### `customer.subscription.deleted`
- Already handled (sets plan to "expired")
- No changes needed

## 6. Failed Payment Banner

**File:** `frontend/src/layouts/AppLayout.jsx`

If `payment_failed` is true in the auth context:
- Show a persistent amber/warning banner at the top of the page
- Text: "Your last payment failed. Please update your payment method."
- "Update Payment" button → calls billing portal endpoint, redirects
- Banner is persistent (not dismissible) until payment succeeds

## 7. Database Migration

**Table:** `user_profiles`
**New column:** `payment_failed BOOLEAN NOT NULL DEFAULT FALSE`

Add via Supabase migration or direct SQL:
```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN NOT NULL DEFAULT FALSE;
```

## 8. Auth Context Updates

**File:** `frontend/src/context/AuthContext.jsx`

Add to the profile fetch:
- Include `payment_failed` field from `user_profiles`
- Expose `payment_failed` in context
- Add a `refreshProfile()` method that re-fetches the profile (used by payment success polling)

## 9. Annual Pricing Fix

The code path already works:
- `stripe_handler.py` maps `pro_annual` → `STRIPE_PRO_ANNUAL_PRICE_ID` env var
- Frontend sends `plan: "pro_annual"` when annual toggle is on
- Only action: ensure `STRIPE_PRO_ANNUAL_PRICE_ID` is set in Render env vars (deployment config, not code)

## Files Modified

**Backend:**
- `backend/main.py` — new endpoints (billing-portal, subscription-status), expanded webhook handler
- `backend/stripe_handler.py` — no changes needed (already has price mapping)

**Frontend:**
- `frontend/src/App.jsx` — payment success/cancel query param handling
- `frontend/src/pages/SettingsPage.jsx` — new file
- `frontend/src/layouts/AppLayout.jsx` — failed payment banner
- `frontend/src/context/AuthContext.jsx` — add payment_failed, refreshProfile()
- `frontend/src/components/UpgradeModal.jsx` — no changes needed

**Database:**
- Add `payment_failed` column to `user_profiles`

**Routing:**
- Add `/settings` route in `App.jsx`

## Out of Scope

- Invoice history page (Stripe portal covers this)
- Refund workflow (handle manually in Stripe dashboard)
- Lifetime deal race condition fix (low priority, affects edge case)
- Email notifications for failed payments (Stripe handles this natively)

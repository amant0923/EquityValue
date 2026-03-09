# ValuEngine SaaS Launch Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ValuEngine from a working prototype into a fully functional paid SaaS product with Stripe payments, backend auth enforcement, branded emails, and production hardening.

**Architecture:** Frontend auth gates + backend JWT verification on every endpoint. Stripe Checkout for payments with webhooks updating the Supabase `user_profiles.plan` field. Custom SMTP for branded transactional emails.

**Tech Stack:** React/Vite, FastAPI, Supabase Auth + DB, Stripe Checkout + Webhooks, Resend (SMTP)

---

## Priority 1: Backend Auth Enforcement (Security-Critical)

Currently all backend endpoints are public — anyone can call `/valuation/AAPL` directly without auth. Tier limits are only enforced client-side in React, which can be bypassed.

### Task 1: Add JWT verification middleware to FastAPI

**Files:**
- Create: `backend/auth.py`
- Modify: `backend/main.py`
- Modify: `backend/requirements.txt`

**Step 1: Install PyJWT**

Add `PyJWT` and `cryptography` to `requirements.txt`:
```
PyJWT
cryptography
```

Run: `pip install PyJWT cryptography`

**Step 2: Create auth.py with JWT verification**

```python
# backend/auth.py
import os
import jwt
from fastapi import Request, HTTPException
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

async def get_current_user(request: Request) -> dict:
    """Extract and verify JWT from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_user_profile(user_id: str) -> dict:
    """Fetch user profile from Supabase to check plan and limits."""
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    result = sb.table("user_profiles").select("*").eq("id", user_id).single().execute()
    return result.data if result.data else {"plan": "free", "analyses_today": 0}
```

**Step 3: Add auth dependency to protected endpoints in main.py**

Add to the `/valuation/{ticker}` endpoint:
```python
from auth import get_current_user, get_user_profile
from fastapi import Depends

@app.get("/valuation/{ticker}")
async def valuation(ticker: str, user: dict = Depends(get_current_user)):
    # Check plan limits
    profile = await get_user_profile(user["sub"])
    # ... existing logic
```

**Step 4: Add JWT token to frontend API calls**

Modify `App.jsx` to pass the Supabase session token in headers:
```javascript
const session = await supabase.auth.getSession();
const token = session?.data?.session?.access_token;
const res = await axios.get(`${API}/valuation/${sym}`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {}
});
```

**Step 5: Commit**
```bash
git add backend/auth.py backend/main.py backend/requirements.txt frontend/src/App.jsx
git commit -m "feat: add backend JWT auth enforcement on protected endpoints"
```

---

## Priority 2: Stripe Payment Integration

### Task 2: Set up Stripe products and checkout

**Files:**
- Create: `backend/stripe_handler.py`
- Modify: `backend/main.py`
- Modify: `backend/requirements.txt`
- Modify: `frontend/src/components/UpgradeModal.jsx`

**Step 1: Install Stripe**

Add `stripe` to `requirements.txt`.

Run: `pip install stripe`

**Step 2: Create Stripe products**

In Stripe Dashboard (https://dashboard.stripe.com):
1. Create Product "ValuEngine Pro" → Price: $15/month recurring
2. Create Product "ValuEngine Max" → Price: $50/month recurring
3. Copy the `price_id` for each (e.g. `price_xxx`)

**Step 3: Create stripe_handler.py**

```python
# backend/stripe_handler.py
import os
import stripe

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

PRICE_TO_PLAN = {
    os.environ.get("STRIPE_PRO_PRICE_ID", ""): "pro",
    os.environ.get("STRIPE_MAX_PRICE_ID", ""): "max",
}

async def create_checkout_session(user_id: str, user_email: str, price_id: str, success_url: str, cancel_url: str):
    session = stripe.checkout.Session.create(
        customer_email=user_email,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user_id},
    )
    return session

def handle_webhook_event(payload: bytes, sig_header: str):
    event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    return event
```

**Step 4: Add Stripe endpoints to main.py**

```python
@app.post("/stripe/create-checkout")
async def create_checkout(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    price_id = body.get("price_id")
    session = await create_checkout_session(
        user_id=user["sub"],
        user_email=user.get("email", ""),
        price_id=price_id,
        success_url="https://valuengine.vercel.app?payment=success",
        cancel_url="https://valuengine.vercel.app?payment=cancelled",
    )
    return {"checkout_url": session.url}

@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    event = handle_webhook_event(payload, sig)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"]["user_id"]
        # Look up price → plan mapping
        subscription = stripe.Subscription.retrieve(session["subscription"])
        price_id = subscription["items"]["data"][0]["price"]["id"]
        plan = PRICE_TO_PLAN.get(price_id, "pro")
        # Update user plan in Supabase
        supabase.table("user_profiles").update({"plan": plan}).eq("id", user_id).execute()

    elif event["type"] == "customer.subscription.deleted":
        # Downgrade to free
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        if user_id:
            supabase.table("user_profiles").update({"plan": "free"}).eq("id", user_id).execute()

    return {"status": "ok"}
```

**Step 5: Update UpgradeModal.jsx to call Stripe checkout**

Replace the hardcoded CTA buttons with:
```javascript
const handleUpgrade = async (priceId) => {
  const session = await supabase.auth.getSession();
  const token = session?.data?.session?.access_token;
  const res = await fetch(`${API}/stripe/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ price_id: priceId }),
  });
  const { checkout_url } = await res.json();
  window.location.href = checkout_url;
};
```

**Step 6: Set env vars**

In Render dashboard, add:
- `STRIPE_SECRET_KEY` — from Stripe Dashboard → Developers → API Keys
- `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard → Webhooks → signing secret
- `STRIPE_PRO_PRICE_ID` — the price ID for Pro plan
- `STRIPE_MAX_PRICE_ID` — the price ID for Max plan

**Step 7: Register webhook in Stripe**

Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://valuengine-api.onrender.com/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`

**Step 8: Commit**
```bash
git add backend/stripe_handler.py backend/main.py backend/requirements.txt frontend/src/components/UpgradeModal.jsx
git commit -m "feat: add Stripe checkout and webhook integration for Pro/Max subscriptions"
```

---

## Priority 3: Branded Emails (Custom SMTP)

### Task 3: Set up Resend for branded transactional emails

**No code changes required — Supabase dashboard config only.**

**Step 1: Sign up for Resend**

Go to https://resend.com → Sign up (free tier: 3,000 emails/month)

**Step 2: Add and verify a domain (optional but recommended)**

Resend Dashboard → Domains → Add domain → `valuengine.com` (or your domain)
Add the DNS records Resend provides (DKIM, SPF, DMARC)

**Step 3: Create an API key in Resend**

Resend Dashboard → API Keys → Create key → Copy it

**Step 4: Configure Supabase SMTP**

Supabase Dashboard → Settings → Authentication → SMTP Settings → Enable Custom SMTP:
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: (your Resend API key)
- Sender name: `ValuEngine`
- Sender email: `no-reply@valuengine.com` (or `no-reply@resend.dev` if no custom domain)

**Step 5: Customize email templates**

Supabase Dashboard → Authentication → Email Templates:
- **Confirm signup** — Add ValuEngine branding, logo, custom copy
- **Magic link** — Customize if using magic link auth later
- **Reset password** — Add branding

---

## Priority 4: Frontend Feature Gating Enforcement

Currently `isFeatureUnlocked()` exists but is not called anywhere in the actual components. Free users can still see and use all features.

### Task 4: Gate locked features in component UI

**Files:**
- Modify: `frontend/src/App.jsx` (AnalysisResults component)
- Modify: `frontend/src/components/InvestmentThesis.jsx`
- Modify: `frontend/src/components/MonteCarlo.jsx`
- Modify: `frontend/src/components/LBOModel.jsx`

**Step 1: Pass auth context to AnalysisResults**

In App.jsx, pass `isFeatureUnlocked` and a callback to show the upgrade modal:
```javascript
<AnalysisResults
  result={result}
  applicable={applicable}
  notApplicable={notApplicable}
  unusedModels={unusedModels}
  onMemoGenerated={setMemoText}
  onMcStats={setMcStats}
  onLboStats={setLboStats}
  isFeatureUnlocked={isFeatureUnlocked}
  onUpgrade={() => { setUpgradeReason("feature"); setShowUpgrade(true); }}
/>
```

**Step 2: Wrap locked components with upgrade prompts**

In AnalysisResults, conditionally render locked components:
```javascript
{isFeatureUnlocked("ai_thesis") ? (
  <InvestmentThesis data={result} onMemoGenerated={onMemoGenerated} />
) : (
  <LockedFeatureCard title="AI Investment Thesis" plan="Pro" onUpgrade={onUpgrade} />
)}
```

**Step 3: Create a LockedFeatureCard component**

A simple card that shows a lock icon, feature name, required plan, and an upgrade button.

**Step 4: Gate PDF export button in topbar**

Only show the PDF export button if `isFeatureUnlocked("pdf_export")`.

**Step 5: Gate Compare page**

Show upgrade prompt instead of compare functionality for free users.

**Step 6: Commit**
```bash
git add frontend/src/App.jsx frontend/src/components/LockedFeatureCard.jsx
git commit -m "feat: enforce feature gating UI for free tier users"
```

---

## Priority 5: Domain & Branding

### Task 5: Buy and configure custom domain

**Step 1: Purchase domain**

Buy `valuengine.com` (or similar) from Namecheap, Cloudflare, or Google Domains (~$10-15/year)

**Step 2: Configure Vercel custom domain**

Vercel → Project Settings → Domains → Add `valuengine.com`
Add the DNS records Vercel provides (A record + CNAME)

**Step 3: Configure Supabase redirect URLs**

Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://valuengine.com`
- Redirect URLs: add `https://valuengine.com`

**Step 4: Update Stripe success/cancel URLs**

In `stripe_handler.py`, update URLs to use the custom domain.

**Step 5: Update frontend references**

Search for `valuengine.vercel.app` and replace with `valuengine.com`.

---

## Priority 6: Production Hardening

### Task 6: Security and reliability improvements

**Step 1: Move hardcoded Supabase credentials to env vars**

In `backend/data_fetcher.py`, remove the default hardcoded key:
```python
_SUPABASE_URL = os.environ.get("SUPABASE_URL")  # No default
_SUPABASE_KEY = os.environ.get("SUPABASE_KEY")   # No default
```

**Step 2: Add rate limiting to backend**

Install `slowapi`:
```
pip install slowapi
```

Add to main.py:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/valuation/{ticker}")
@limiter.limit("30/minute")
async def valuation(request: Request, ticker: str):
    ...
```

**Step 3: Add error monitoring**

Sign up for Sentry (free tier). Add to backend:
```
pip install sentry-sdk[fastapi]
```
```python
import sentry_sdk
sentry_sdk.init(dsn="your-dsn-here")
```

**Step 4: Add HTTPS-only cookies and security headers**

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["valuengine-api.onrender.com", "valuengine.com"])
```

**Step 5: Restrict CORS to known origins**

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://valuengine.vercel.app", "https://valuengine.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Step 6: Commit**
```bash
git add backend/main.py backend/data_fetcher.py backend/requirements.txt
git commit -m "feat: production hardening — rate limiting, CORS, security headers"
```

---

## Priority 7: Account Management Page

### Task 7: Build account/billing page

**Files:**
- Create: `frontend/src/pages/AccountPage.jsx`
- Modify: `frontend/src/App.jsx` (add route)
- Modify: `frontend/src/components/Sidebar.jsx` (add nav item)

**Features:**
- Show current plan, usage stats, email
- "Manage Subscription" button → Stripe Customer Portal
- "Change Password" functionality via Supabase
- "Delete Account" with confirmation

**Stripe Customer Portal:**
Add endpoint in main.py:
```python
@app.post("/stripe/portal")
async def create_portal(request: Request, user: dict = Depends(get_current_user)):
    profile = await get_user_profile(user["sub"])
    session = stripe.billing_portal.Session.create(
        customer=profile.get("stripe_customer_id"),
        return_url="https://valuengine.com/account",
    )
    return {"portal_url": session.url}
```

---

## Priority 8: Analytics & Monitoring

### Task 8: Add usage analytics

**Options (pick one):**
- **PostHog** (free, open-source) — user analytics, funnels, feature flags
- **Plausible** (privacy-focused, $9/mo) — simple page analytics
- **Vercel Analytics** (free tier) — basic web vitals

**Track:**
- Sign-ups and conversion rate
- Most searched tickers
- Feature usage by tier
- Upgrade modal impressions → checkout conversions

---

## Execution Order Summary

| # | Task | Effort | Dependency |
|---|------|--------|------------|
| 1 | Backend auth enforcement | 2-3 hrs | None |
| 2 | Stripe payment integration | 3-4 hrs | Task 1 |
| 3 | Branded emails (Resend) | 30 min | None (dashboard only) |
| 4 | Frontend feature gating | 1-2 hrs | None |
| 5 | Custom domain | 30 min | None (DNS config) |
| 6 | Production hardening | 1-2 hrs | Task 1 |
| 7 | Account management page | 2-3 hrs | Task 2 |
| 8 | Analytics | 30 min | None |

**Tasks 1, 3, 4, 5 can be done in parallel.**
**Task 2 requires Task 1. Task 7 requires Task 2. Task 6 requires Task 1.**

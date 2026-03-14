"""Admin endpoints — list users, change plans, delete users, reset passwords."""
import os
import time
import hashlib
import hmac
from fastapi import APIRouter, HTTPException, Depends, Body, Request
from auth import get_current_user
from supabase import create_client

router = APIRouter(prefix="/admin", tags=["admin"])

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# Admin credentials (REQUIRED env vars — no defaults)
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

if not ADMIN_USERNAME or not ADMIN_PASSWORD:
    import warnings
    warnings.warn("ADMIN_USERNAME and ADMIN_PASSWORD not set — admin endpoints disabled")

# Secret for signing admin tokens
_ADMIN_SECRET = os.environ.get("ADMIN_TOKEN_SECRET", SUPABASE_SERVICE_KEY or "ev-admin-secret-key")

# Comma-separated list of admin emails (for Supabase-auth-based admin access)
ADMIN_EMAILS = set(
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "").split(",")
    if e.strip()
)


def _make_admin_token():
    """Generate a signed admin token valid for 24 hours."""
    expires = int(time.time()) + 86400
    payload = f"admin:{expires}"
    sig = hmac.new(_ADMIN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def _verify_admin_token(token: str) -> bool:
    """Verify an admin token is valid and not expired."""
    parts = token.split(":")
    if len(parts) != 3:
        return False
    role, expires_str, sig = parts
    if role != "admin":
        return False
    try:
        expires = int(expires_str)
    except ValueError:
        return False
    if time.time() > expires:
        return False
    expected = hmac.new(_ADMIN_SECRET.encode(), f"{role}:{expires_str}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected)


def _get_sb():
    """Get Supabase client with service_role key (bypasses RLS)."""
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_KEY not configured — required for admin access")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _require_admin_from_request(request: Request):
    """Check admin access from either admin token or Supabase auth."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("AdminToken "):
        token = auth_header.split(" ", 1)[1]
        if _verify_admin_token(token):
            return
        raise HTTPException(403, "Invalid or expired admin token")
    # No admin token — will be checked via Supabase auth in individual endpoints
    raise HTTPException(401, "Not authenticated")


async def _require_admin(request: Request):
    """Check admin access: admin token OR Supabase user in ADMIN_EMAILS."""
    auth_header = request.headers.get("Authorization", "")
    # Check admin token first
    if auth_header.startswith("AdminToken "):
        token = auth_header.split(" ", 1)[1]
        if _verify_admin_token(token):
            return {"role": "admin", "email": "admin"}
        raise HTTPException(403, "Invalid or expired admin token")
    # Fall back to Supabase auth
    user = await get_current_user(request)
    email = (user.get("email") or "").lower()
    if email and email in ADMIN_EMAILS:
        return user
    raise HTTPException(403, "Admin access required")


@router.post("/login")
async def admin_login(username: str = Body(...), password: str = Body(...)):
    """Authenticate with admin username/password, returns a signed token."""
    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        raise HTTPException(401, "Invalid username or password")
    token = _make_admin_token()
    return {"token": token}


@router.get("/users")
async def list_users(request: Request):
    await _require_admin(request)
    sb = _get_sb()

    # Fetch all user profiles
    profiles = sb.table("user_profiles").select("*").execute().data or []
    profile_map = {p["id"]: p for p in profiles}

    # Fetch auth users via Supabase Admin API (paginated, 50 per page)
    auth_users = []
    page = 1
    try:
        while True:
            batch = sb.auth.admin.list_users(page=page, per_page=50)
            if not batch:
                break
            auth_users.extend(batch)
            if len(batch) < 50:
                break
            page += 1
    except Exception as e:
        raise HTTPException(500, f"Failed to list auth users: {e}")

    users = []
    for au in auth_users:
        uid = au.id
        profile = profile_map.get(uid, {})
        users.append({
            "id": uid,
            "email": au.email,
            "created_at": au.created_at.isoformat() if au.created_at else None,
            "last_sign_in": au.last_sign_in_at.isoformat() if au.last_sign_in_at else None,
            "email_confirmed": au.email_confirmed_at is not None,
            "plan": profile.get("plan", "free"),
            "analyses_today": profile.get("analyses_today", 0),
            "last_analysis_date": str(profile.get("last_analysis_date", "")),
            "stripe_customer_id": profile.get("stripe_customer_id"),
        })

    # Sort by created_at descending (newest first)
    users.sort(key=lambda u: u["created_at"] or "", reverse=True)
    return {"users": users, "total": len(users)}


@router.patch("/users/{user_id}/plan")
async def update_user_plan(
    request: Request,
    user_id: str,
    plan: str = Body(..., embed=True),
):
    await _require_admin(request)
    if plan not in ("free", "pro", "max"):
        raise HTTPException(400, "Plan must be free, pro, or max")
    sb = _get_sb()
    try:
        sb.table("user_profiles").update({"plan": plan}).eq("id", user_id).execute()
    except Exception as e:
        raise HTTPException(500, f"Failed to update plan: {e}")
    return {"ok": True, "user_id": user_id, "plan": plan}


@router.delete("/users/{user_id}")
async def delete_user(request: Request, user_id: str):
    admin = await _require_admin(request)
    sb = _get_sb()
    # Don't allow deleting yourself
    if admin.get("sub") == user_id:
        raise HTTPException(400, "Cannot delete your own account")
    try:
        sb.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(500, f"Failed to delete user: {e}")
    return {"ok": True, "deleted": user_id}


@router.post("/users/{user_id}/reset-password")
async def reset_password(request: Request, user_id: str):
    await _require_admin(request)
    sb = _get_sb()
    # Get user email first
    try:
        target = sb.auth.admin.get_user_by_id(user_id)
        if not target or not target.user:
            raise HTTPException(404, "User not found")
        email = target.user.email
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to find user: {e}")

    # Send password reset email
    try:
        sb.auth.admin.generate_link({"type": "recovery", "email": email})
    except Exception as e:
        raise HTTPException(500, f"Failed to send reset email: {e}")
    return {"ok": True, "email": email}


@router.get("/check")
async def check_admin(request: Request):
    """Check if the current user is an admin (via token or Supabase)."""
    try:
        await _require_admin(request)
        return {"is_admin": True}
    except HTTPException:
        return {"is_admin": False}

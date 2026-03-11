"""Admin endpoints — list users, change plans, delete users, reset passwords."""
import os
from fastapi import APIRouter, HTTPException, Depends, Body
from auth import get_current_user
from supabase import create_client

router = APIRouter(prefix="/admin", tags=["admin"])

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYnRnbnBsb3Rsc2hyd2JvdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDEzODIsImV4cCI6MjA4ODQ3NzM4Mn0.grKm3Rh-UtXU3bIz2ajLNiVxbfTECC9cwuslZe_BY-I",
)

# Comma-separated list of admin emails
ADMIN_EMAILS = set(
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "").split(",")
    if e.strip()
)


def _get_sb():
    """Get Supabase client with service_role key (bypasses RLS)."""
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_KEY not configured — required for admin access")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _require_admin(user: dict):
    """Check that the authenticated user is an admin."""
    email = (user.get("email") or "").lower()
    if not email or email not in ADMIN_EMAILS:
        raise HTTPException(403, "Admin access required")


@router.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    _require_admin(user)
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
    user_id: str,
    plan: str = Body(..., embed=True),
    user: dict = Depends(get_current_user),
):
    _require_admin(user)
    if plan not in ("free", "pro", "max"):
        raise HTTPException(400, "Plan must be free, pro, or max")
    sb = _get_sb()
    try:
        sb.table("user_profiles").update({"plan": plan}).eq("id", user_id).execute()
    except Exception as e:
        raise HTTPException(500, f"Failed to update plan: {e}")
    return {"ok": True, "user_id": user_id, "plan": plan}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    _require_admin(user)
    sb = _get_sb()
    # Don't allow deleting yourself
    if user.get("sub") == user_id:
        raise HTTPException(400, "Cannot delete your own account")
    try:
        sb.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(500, f"Failed to delete user: {e}")
    return {"ok": True, "deleted": user_id}


@router.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, user: dict = Depends(get_current_user)):
    _require_admin(user)
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
async def check_admin(user: dict = Depends(get_current_user)):
    """Check if the current user is an admin."""
    email = (user.get("email") or "").lower()
    return {"is_admin": email in ADMIN_EMAILS}

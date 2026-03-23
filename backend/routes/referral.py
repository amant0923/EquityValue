"""Referral system endpoints — 1 month free for referrer when referee converts."""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import re
import secrets
import logging
from auth import get_current_user
from rate_limit import limiter
from db import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/referral")


class ReferralSignup(BaseModel):
    referral_code: str


@router.post("/track")
@limiter.limit("10/minute")
async def track_referral(request: Request, body: ReferralSignup, user=Depends(get_current_user)):
    """Track that a new user signed up via referral link."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    code = body.referral_code.strip()
    if not code or len(code) < 6 or len(code) > 24:
        raise HTTPException(400, "Invalid referral code")
    # Validate referral code format: URL-safe base64 or legacy hex prefix
    if not re.match(r'^[A-Za-z0-9_-]{6,24}$', code):
        raise HTTPException(400, "Invalid referral code format")
    # Look up by referral_code column first (new random codes),
    # then fall back to UUID prefix match (legacy codes)
    row = sb.table("user_profiles").select("id").eq("referral_code", code).limit(1).execute().data
    if row:
        referrer_id = row[0]["id"]
    else:
        # Legacy fallback: match UUID prefix for old referral links
        users = sb.table("user_profiles").select("id").execute().data or []
        referrer_id = None
        for u in users:
            if u["id"][:8] == code:
                referrer_id = u["id"]
                break
    if not referrer_id:
        raise HTTPException(404, "Referral code not found")
    if referrer_id == user["sub"]:
        raise HTTPException(400, "Cannot refer yourself")
    # Store referral relationship
    try:
        sb.table("referrals").upsert({
            "referee_id": user["sub"],
            "referrer_id": referrer_id,
            "status": "signed_up",
        }, on_conflict="referee_id").execute()
    except Exception as e:
        logger.error("Referral tracking failed")
    return {"status": "tracked"}


@router.post("/convert")
@limiter.limit("10/minute")
async def convert_referral(request: Request, user=Depends(get_current_user)):
    """Called when a referred user upgrades to paid. Awards credit to referrer."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    # Find the referral record
    rows = sb.table("referrals").select("*").eq("referee_id", user["sub"]).eq("status", "signed_up").execute().data
    if not rows:
        return {"status": "no_referral"}
    ref = rows[0]
    # Update status to converted
    sb.table("referrals").update({"status": "converted"}).eq("referee_id", user["sub"]).execute()
    # Award 1 month credit to referrer
    try:
        referrer_profile = sb.table("user_profiles").select("*").eq("id", ref["referrer_id"]).single().execute().data
        current_credits = referrer_profile.get("referral_credits", 0) if referrer_profile else 0
        sb.table("user_profiles").update({
            "referral_credits": current_credits + 1,
        }).eq("id", ref["referrer_id"]).execute()
    except Exception as e:
        logger.error("Referral conversion credit failed")
    return {"status": "converted", "referrer_credited": True}


@router.get("/code")
@limiter.limit("10/minute")
async def get_referral_code(request: Request, user=Depends(get_current_user)):
    """Get or generate the user's cryptographically random referral code."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    user_id = user["sub"]
    profile = sb.table("user_profiles").select("referral_code").eq("id", user_id).single().execute().data
    if profile and profile.get("referral_code"):
        return {"code": profile["referral_code"]}
    # Generate a new random code and store it
    code = secrets.token_urlsafe(12)  # 16 chars, cryptographically random
    try:
        sb.table("user_profiles").update({"referral_code": code}).eq("id", user_id).execute()
    except Exception:
        logger.error("Failed to save referral code")
    return {"code": code}


@router.get("/stats")
@limiter.limit("10/minute")
async def referral_stats(request: Request, user=Depends(get_current_user)):
    """Get referral stats for current user."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    referrer_id = user["sub"]
    try:
        rows = sb.table("referrals").select("status").eq("referrer_id", referrer_id).execute().data or []
        signups = len(rows)
        conversions = len([r for r in rows if r["status"] == "converted"])
        profile = sb.table("user_profiles").select("referral_credits").eq("id", referrer_id).single().execute().data
        credits = profile.get("referral_credits", 0) if profile else 0
        return {"referrals": signups, "conversions": conversions, "credits_earned": credits}
    except Exception as e:
        logger.error("Referral stats fetch failed")
        return {"referrals": 0, "conversions": 0, "credits_earned": 0}

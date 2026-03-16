"""Alert subscription and history endpoints."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
import os
from supabase import create_client
from auth import get_current_user

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None

router = APIRouter(prefix="/alerts")


class AlertSubscription(BaseModel):
    ticker: str
    alert_type: str  # score_threshold, score_change, verdict_flip, analyst_shift
    threshold: int | None = None


class WatchlistSync(BaseModel):
    tickers: List[str]


@router.post("/subscribe")
async def subscribe(body: AlertSubscription, user=Depends(get_current_user)):
    if not sb:
        raise HTTPException(503, "Database not configured")
    sb.table("user_alerts").insert({
        "user_id": user["sub"],
        "ticker": body.ticker.upper(),
        "alert_type": body.alert_type,
        "threshold": body.threshold,
    }).execute()
    return {"status": "subscribed"}


@router.post("/sync-watchlist")
async def sync_watchlist(body: WatchlistSync, user=Depends(get_current_user)):
    """Auto-create score_change and verdict_flip alert subscriptions for
    each ticker in the user's watchlist, skipping any that already exist."""
    if not sb:
        raise HTTPException(503, "Database not configured")

    user_id = user["sub"]
    tickers = [t.upper().strip() for t in body.tickers if t.strip()]
    if not tickers:
        return {"created": 0, "skipped": 0}

    # Fetch existing subscriptions for this user in one query
    existing_rows = sb.table("user_alerts") \
        .select("ticker, alert_type") \
        .eq("user_id", user_id) \
        .eq("enabled", True) \
        .execute().data
    existing_keys = {(r["ticker"], r["alert_type"]) for r in existing_rows}

    created = 0
    skipped = 0
    auto_types = ["score_change", "verdict_flip"]

    for ticker in tickers:
        for alert_type in auto_types:
            if (ticker, alert_type) in existing_keys:
                skipped += 1
                continue
            sb.table("user_alerts").insert({
                "user_id": user_id,
                "ticker": ticker,
                "alert_type": alert_type,
                "threshold": None,
            }).execute()
            created += 1

    return {"created": created, "skipped": skipped}


@router.get("/subscriptions")
async def subscriptions(user=Depends(get_current_user)):
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("user_alerts") \
        .select("*") \
        .eq("user_id", user["sub"]) \
        .eq("enabled", True) \
        .order("created_at", desc=True) \
        .execute().data
    return rows


@router.get("/history")
async def history(user=Depends(get_current_user)):
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("alert_history") \
        .select("*") \
        .eq("user_id", user["sub"]) \
        .order("triggered_at", desc=True) \
        .limit(50) \
        .execute().data
    return rows


@router.put("/{alert_id}/read")
async def mark_read(alert_id: int, user=Depends(get_current_user)):
    if not sb:
        raise HTTPException(503, "Database not configured")
    sb.table("alert_history") \
        .update({"read": True}) \
        .eq("id", alert_id) \
        .eq("user_id", user["sub"]) \
        .execute()
    return {"status": "read"}


@router.delete("/{alert_id}")
async def unsubscribe(alert_id: int, user=Depends(get_current_user)):
    if not sb:
        raise HTTPException(503, "Database not configured")
    sb.table("user_alerts") \
        .delete() \
        .eq("id", alert_id) \
        .eq("user_id", user["sub"]) \
        .execute()
    return {"status": "unsubscribed"}

"""Accuracy tracking API endpoints."""
from fastapi import APIRouter, HTTPException
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None

router = APIRouter(prefix="/accuracy")


@router.get("/models")
async def model_accuracy():
    """Aggregate accuracy stats per model. Public endpoint."""
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("accuracy_tracking") \
        .select("model_name, direction_correct_6mo, direction_correct_12mo") \
        .execute().data
    models = {}
    for row in rows:
        name = row["model_name"]
        if name not in models:
            models[name] = {"total_6mo": 0, "correct_6mo": 0, "total_12mo": 0, "correct_12mo": 0}
        if row.get("direction_correct_6mo") is not None:
            models[name]["total_6mo"] += 1
            if row["direction_correct_6mo"]:
                models[name]["correct_6mo"] += 1
        if row.get("direction_correct_12mo") is not None:
            models[name]["total_12mo"] += 1
            if row["direction_correct_12mo"]:
                models[name]["correct_12mo"] += 1
    result = []
    for name, stats in models.items():
        result.append({
            "model": name,
            "accuracy_6mo": round(stats["correct_6mo"] / stats["total_6mo"] * 100, 1) if stats["total_6mo"] > 0 else None,
            "accuracy_12mo": round(stats["correct_12mo"] / stats["total_12mo"] * 100, 1) if stats["total_12mo"] > 0 else None,
            "sample_size_6mo": stats["total_6mo"],
            "sample_size_12mo": stats["total_12mo"],
        })
    result.sort(key=lambda x: x.get("accuracy_6mo") or 0, reverse=True)
    return result


@router.get("/score")
async def score_accuracy():
    """EVS backtest: returns by score range. Public endpoint."""
    if not sb:
        raise HTTPException(503, "Database not configured")
    return {"message": "Accuracy tracking active. Data available after 6 months of collection.", "status": "collecting"}


@router.get("/{ticker}")
async def ticker_accuracy(ticker: str):
    """Per-ticker accuracy history. Pro-gated."""
    ticker = ticker.upper().strip()
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("accuracy_tracking") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("snapshot_date", desc=True) \
        .limit(100) \
        .execute().data
    return rows

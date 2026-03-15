"""Accuracy tracking API endpoints."""
from fastapi import APIRouter, HTTPException
import os
from supabase import create_client
from utils.wilson import wilson_confidence_interval

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None

router = APIRouter(prefix="/accuracy")


@router.get("/models")
async def accuracy_models():
    """Aggregate accuracy stats per model with Wilson confidence intervals."""
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
    max_samples_6mo = 0
    for name, stats in models.items():
        acc_6mo = round(stats["correct_6mo"] / stats["total_6mo"] * 100, 1) if stats["total_6mo"] > 0 else None
        acc_12mo = round(stats["correct_12mo"] / stats["total_12mo"] * 100, 1) if stats["total_12mo"] > 0 else None

        # Wilson confidence intervals
        if stats["total_6mo"] > 0:
            p_6mo = stats["correct_6mo"] / stats["total_6mo"]
            ci_6mo_raw = wilson_confidence_interval(p_6mo, stats["total_6mo"])
            ci_6mo = [round(ci_6mo_raw[0] * 100, 1), round(ci_6mo_raw[1] * 100, 1)]
        else:
            ci_6mo = None

        if stats["total_12mo"] > 0:
            p_12mo = stats["correct_12mo"] / stats["total_12mo"]
            ci_12mo_raw = wilson_confidence_interval(p_12mo, stats["total_12mo"])
            ci_12mo = [round(ci_12mo_raw[0] * 100, 1), round(ci_12mo_raw[1] * 100, 1)]
        else:
            ci_12mo = None

        max_samples_6mo = max(max_samples_6mo, stats["total_6mo"])

        result.append({
            "model_name": name,
            "accuracy_6mo": acc_6mo,
            "accuracy_12mo": acc_12mo,
            "ci_6mo": ci_6mo,
            "ci_12mo": ci_12mo,
            "samples_6mo": stats["total_6mo"],
            "samples_12mo": stats["total_12mo"],
        })
    result.sort(key=lambda x: x.get("accuracy_6mo") or 0, reverse=True)
    status = "active" if max_samples_6mo > 20 else "collecting"
    return {"models": result, "status": status}


@router.get("/public")
async def accuracy_public():
    """Public JSON summary for third-party verification."""
    models_data = await accuracy_models()
    return {
        "platform": "Equity Value",
        "url": "https://equityvalue.ai/accuracy",
        "methodology": "Directional accuracy: predicted direction (IV > price) vs actual price movement",
        "data_since": "2026-03-14",
        "models": models_data["models"],
        "status": models_data["status"],
    }


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

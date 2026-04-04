"""Accuracy tracking API endpoints."""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from config import validate_ticker
from utils.wilson import wilson_confidence_interval
from rate_limit import limiter
from db import get_supabase

router = APIRouter(prefix="/accuracy")

OUTLIER_MODELS = {
    "Gordon Growth Model (DDM)",
    "Graham Number",
    "Residual Income",
    "Capitalization of Earnings",
}

WINDOWS = [
    ("14d", "direction_correct_14d"),
    ("30d", "direction_correct_30d"),
    ("6mo", "direction_correct_6mo"),
    ("12mo", "direction_correct_12mo"),
]


@router.get("/models")
@limiter.limit("30/minute")
async def accuracy_models(request: Request):
    """Aggregate accuracy stats per model with Wilson confidence intervals."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    rows = sb.table("accuracy_tracking") \
        .select("model_name, direction_correct_14d, direction_correct_30d, direction_correct_6mo, direction_correct_12mo, intrinsic_value, price_at_snapshot, sector") \
        .limit(50000) \
        .execute().data

    if not rows:
        return {"models": [], "status": "collecting", "consensus_accuracy": None, "undervalued_accuracy": None, "sectors": [], "data_since": None, "snapshot_count": 0}

    # Snapshot metadata
    snap_meta = sb.table("valuation_snapshots").select("snapshot_date").order("snapshot_date").limit(1).execute().data
    data_since = snap_meta[0]["snapshot_date"] if snap_meta else None

    snap_count_rows = sb.table("valuation_snapshots").select("id", count="exact").execute()
    snapshot_count = snap_count_rows.count if snap_count_rows.count else 0

    # Per-model aggregation
    models = {}
    # Consensus-only aggregation
    consensus_total = {w[0]: 0 for w in WINDOWS}
    consensus_correct = {w[0]: 0 for w in WINDOWS}
    # Undervalued-only aggregation (consensus models, IV > price_at)
    uv_total = 0
    uv_correct = 0
    # Sector aggregation
    sector_stats = {}

    for row in rows:
        name = row["model_name"]
        if name not in models:
            models[name] = {}
            for wkey, _ in WINDOWS:
                models[name][f"total_{wkey}"] = 0
                models[name][f"correct_{wkey}"] = 0

        is_consensus = name not in OUTLIER_MODELS
        iv = row.get("intrinsic_value")
        price_at = row.get("price_at_snapshot")
        is_undervalued = iv is not None and price_at is not None and iv > price_at
        sector = row.get("sector", "Unknown")

        for wkey, col in WINDOWS:
            val = row.get(col)
            if val is not None:
                models[name][f"total_{wkey}"] += 1
                if val:
                    models[name][f"correct_{wkey}"] += 1
                if is_consensus:
                    consensus_total[wkey] += 1
                    if val:
                        consensus_correct[wkey] += 1

        # Undervalued accuracy — use best available short-term window
        best_col = None
        for _, col in WINDOWS:
            if row.get(col) is not None:
                best_col = col
                break
        if best_col is not None and is_consensus and is_undervalued:
            uv_total += 1
            if row[best_col]:
                uv_correct += 1

        # Sector stats — use best available window
        if best_col is not None and is_consensus:
            if sector not in sector_stats:
                sector_stats[sector] = {"total": 0, "correct": 0}
            sector_stats[sector]["total"] += 1
            if row[best_col]:
                sector_stats[sector]["correct"] += 1

    # Build model results
    result = []
    max_samples_14d = 0
    max_samples_6mo = 0
    for name, stats in models.items():
        model_data = {
            "model_name": name,
            "is_consensus": name not in OUTLIER_MODELS,
        }
        for wkey, _ in WINDOWS:
            total = stats[f"total_{wkey}"]
            correct = stats[f"correct_{wkey}"]
            acc = round(correct / total * 100, 1) if total > 0 else None
            if total > 0:
                p = correct / total
                ci_raw = wilson_confidence_interval(p, total)
                ci = [round(ci_raw[0] * 100, 1), round(ci_raw[1] * 100, 1)]
            else:
                ci = None
            model_data[f"accuracy_{wkey}"] = acc
            model_data[f"ci_{wkey}"] = ci
            model_data[f"samples_{wkey}"] = total

        max_samples_14d = max(max_samples_14d, stats.get("total_14d", 0))
        max_samples_6mo = max(max_samples_6mo, stats.get("total_6mo", 0))
        result.append(model_data)

    # Sort by best available window accuracy
    def sort_key(m):
        for wkey in ["6mo", "12mo", "30d", "14d"]:
            if m.get(f"accuracy_{wkey}") is not None:
                return m[f"accuracy_{wkey}"]
        return 0
    result.sort(key=sort_key, reverse=True)

    # Consensus accuracy for best available window
    best_window = None
    for wkey, _ in WINDOWS:
        if consensus_total[wkey] > 0:
            best_window = wkey
            break
    consensus_acc = round(consensus_correct[best_window] / consensus_total[best_window] * 100, 1) if best_window and consensus_total[best_window] > 0 else None

    # Undervalued accuracy
    uv_acc = round(uv_correct / uv_total * 100, 1) if uv_total > 0 else None

    # Status
    if max_samples_6mo > 20:
        status = "active"
    elif max_samples_14d > 20:
        status = "beta"
    else:
        status = "collecting"

    # Sectors
    sectors = []
    for sec, s in sector_stats.items():
        if s["total"] >= 10:
            acc = round(s["correct"] / s["total"] * 100, 1)
            p = s["correct"] / s["total"]
            ci_raw = wilson_confidence_interval(p, s["total"])
            ci = [round(ci_raw[0] * 100, 1), round(ci_raw[1] * 100, 1)]
            sectors.append({"sector": sec, "accuracy_pct": acc, "sample_size": s["total"], "ci": ci})
    sectors.sort(key=lambda x: x["accuracy_pct"], reverse=True)

    return {
        "models": result,
        "status": status,
        "consensus_accuracy": consensus_acc,
        "undervalued_accuracy": uv_acc,
        "sectors": sectors,
        "data_since": data_since,
        "snapshot_count": snapshot_count,
    }


@router.get("/highlights")
@limiter.limit("30/minute")
async def accuracy_highlights(request: Request):
    """Pre-computed hero stats for the accuracy page. Public endpoint."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    rows = sb.table("accuracy_tracking") \
        .select("model_name, direction_correct_14d, direction_correct_30d, intrinsic_value, price_at_snapshot, sector") \
        .limit(50000) \
        .execute().data

    if not rows:
        return {"consensus_accuracy_pct": None, "undervalued_accuracy_pct": None, "top_model": None, "total_snapshots": 0, "trading_days": 0, "data_since": None, "evaluation_window_days": 0, "top_sectors": []}

    # Snapshot metadata
    snap_dates = sb.table("valuation_snapshots").select("snapshot_date").execute().data
    unique_dates = sorted(set(r["snapshot_date"] for r in snap_dates)) if snap_dates else []
    data_since = unique_dates[0] if unique_dates else None
    trading_days = len(unique_dates)

    snap_count_rows = sb.table("valuation_snapshots").select("id", count="exact").execute()
    total_snapshots = snap_count_rows.count if snap_count_rows.count else 0

    # Calculate evaluation window
    if data_since:
        from datetime import date as date_type
        try:
            first = date_type.fromisoformat(data_since)
            today = datetime.now(timezone.utc).date()
            evaluation_window_days = (today - first).days
        except Exception:
            evaluation_window_days = 0
    else:
        evaluation_window_days = 0

    # Use best available short-term window
    best_col = "direction_correct_14d"
    fallback_col = "direction_correct_30d"

    # Per-model stats (consensus only)
    model_stats = {}
    consensus_total = 0
    consensus_correct = 0
    uv_total = 0
    uv_correct = 0
    sector_stats = {}

    for row in rows:
        name = row["model_name"]
        is_consensus = name not in OUTLIER_MODELS
        val = row.get(best_col)
        if val is None:
            val = row.get(fallback_col)
        if val is None:
            continue

        if is_consensus:
            consensus_total += 1
            if val:
                consensus_correct += 1

            if name not in model_stats:
                model_stats[name] = {"total": 0, "correct": 0}
            model_stats[name]["total"] += 1
            if val:
                model_stats[name]["correct"] += 1

            # Undervalued
            iv = row.get("intrinsic_value")
            price_at = row.get("price_at_snapshot")
            if iv and price_at and iv > price_at:
                uv_total += 1
                if val:
                    uv_correct += 1

            # Sector
            sector = row.get("sector", "Unknown")
            if sector not in sector_stats:
                sector_stats[sector] = {"total": 0, "correct": 0}
            sector_stats[sector]["total"] += 1
            if val:
                sector_stats[sector]["correct"] += 1

    consensus_acc = round(consensus_correct / consensus_total * 100, 1) if consensus_total > 0 else None
    uv_acc = round(uv_correct / uv_total * 100, 1) if uv_total > 0 else None

    # Top model
    top_model = None
    if model_stats:
        best_name = max(model_stats, key=lambda k: model_stats[k]["correct"] / model_stats[k]["total"] if model_stats[k]["total"] > 10 else 0)
        best = model_stats[best_name]
        if best["total"] > 10:
            top_model = {"name": best_name, "accuracy_pct": round(best["correct"] / best["total"] * 100, 1)}

    # Top sectors (sample_size > 50)
    top_sectors = []
    for sec, s in sector_stats.items():
        if s["total"] > 50:
            top_sectors.append({"sector": sec, "accuracy_pct": round(s["correct"] / s["total"] * 100, 1), "sample_size": s["total"]})
    top_sectors.sort(key=lambda x: x["accuracy_pct"], reverse=True)
    top_sectors = top_sectors[:5]

    return {
        "consensus_accuracy_pct": consensus_acc,
        "undervalued_accuracy_pct": uv_acc,
        "top_model": top_model,
        "total_snapshots": total_snapshots,
        "trading_days": trading_days,
        "data_since": data_since,
        "evaluation_window_days": evaluation_window_days,
        "top_sectors": top_sectors,
    }


@router.get("/public")
@limiter.limit("30/minute")
async def accuracy_public(request: Request):
    """Public JSON summary for third-party verification."""
    models_data = await accuracy_models(request)
    return {
        "platform": "Equity Value",
        "url": "https://equityvalue.ai/accuracy",
        "methodology": "Directional accuracy: predicted direction (IV > price) vs actual price movement",
        "data_since": "2026-03-14",
        "models": models_data["models"],
        "status": models_data["status"],
    }


@router.get("/score")
@limiter.limit("30/minute")
async def score_accuracy(request: Request):
    """EVS backtest: returns by score range. Public endpoint."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    return {"message": "Accuracy tracking active. Data available after 6 months of collection.", "status": "collecting"}


@router.get("/{ticker}")
@limiter.limit("30/minute")
async def ticker_accuracy(request: Request, ticker: str):
    """Per-ticker accuracy history. Pro-gated."""
    ticker = validate_ticker(ticker)
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("accuracy_tracking") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("snapshot_date", desc=True) \
        .limit(100) \
        .execute().data
    return rows

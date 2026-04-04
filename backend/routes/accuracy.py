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


def _compute_live_accuracy(sb):
    """Compute accuracy on-the-fly from valuation_snapshots + current prices.

    Used when accuracy_tracking table is empty (backfill hasn't run yet).
    Compares each snapshot's predicted direction to actual price movement.
    """
    # Get all snapshots
    snapshots = sb.table("valuation_snapshots") \
        .select("ticker, snapshot_date, model_name, intrinsic_value, price_at_snapshot") \
        .order("snapshot_date") \
        .limit(50000) \
        .execute().data

    if not snapshots:
        return None

    # Get current prices + sectors
    funds = sb.table("stock_fundamentals") \
        .select("ticker, current_price, sector") \
        .execute().data
    price_map = {f["ticker"]: f.get("current_price") for f in funds if f.get("current_price")}
    sector_map = {f["ticker"]: f.get("sector", "Unknown") for f in funds}

    # Unique dates for metadata
    unique_dates = sorted(set(s["snapshot_date"] for s in snapshots))
    data_since = unique_dates[0] if unique_dates else None
    trading_days = len(unique_dates)
    total_snapshots = len(snapshots)

    # Evaluate each snapshot
    models = {}
    consensus_total = 0
    consensus_correct = 0
    uv_total = 0
    uv_correct = 0
    sector_stats = {}

    for snap in snapshots:
        ticker = snap["ticker"]
        current_price = price_map.get(ticker)
        if not current_price:
            continue
        iv = snap.get("intrinsic_value")
        price_at = snap.get("price_at_snapshot")
        if not iv or not price_at:
            continue

        predicted_up = iv > price_at
        actual_up = current_price > price_at
        correct = predicted_up == actual_up
        name = snap["model_name"]
        is_consensus = name not in OUTLIER_MODELS
        sector = sector_map.get(ticker, "Unknown")

        if name not in models:
            models[name] = {"total": 0, "correct": 0}
        models[name]["total"] += 1
        if correct:
            models[name]["correct"] += 1

        if is_consensus:
            consensus_total += 1
            if correct:
                consensus_correct += 1

            # Undervalued accuracy
            if predicted_up:
                uv_total += 1
                if correct:
                    uv_correct += 1

            # Sector stats
            if sector not in sector_stats:
                sector_stats[sector] = {"total": 0, "correct": 0}
            sector_stats[sector]["total"] += 1
            if correct:
                sector_stats[sector]["correct"] += 1

    # Build model results
    model_results = []
    max_samples = 0
    for name, stats in models.items():
        total = stats["total"]
        correct = stats["correct"]
        acc = round(correct / total * 100, 1) if total > 0 else None
        ci = None
        if total > 0:
            p = correct / total
            ci_raw = wilson_confidence_interval(p, total)
            ci = [round(ci_raw[0] * 100, 1), round(ci_raw[1] * 100, 1)]
        max_samples = max(max_samples, total)
        is_consensus = name not in OUTLIER_MODELS
        model_results.append({
            "model_name": name,
            "is_consensus": is_consensus,
            "accuracy_14d": acc,
            "ci_14d": ci,
            "samples_14d": total,
            "accuracy_30d": None,
            "ci_30d": None,
            "samples_30d": 0,
            "accuracy_6mo": None,
            "ci_6mo": None,
            "samples_6mo": 0,
            "accuracy_12mo": None,
            "ci_12mo": None,
            "samples_12mo": 0,
        })
    model_results.sort(key=lambda m: m.get("accuracy_14d") or 0, reverse=True)

    consensus_acc = round(consensus_correct / consensus_total * 100, 1) if consensus_total > 0 else None
    uv_acc = round(uv_correct / uv_total * 100, 1) if uv_total > 0 else None

    status = "beta" if max_samples > 20 else "collecting"

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

    # Top model (consensus only, min 10 samples)
    consensus_models = {n: s for n, s in models.items() if n not in OUTLIER_MODELS and s["total"] > 10}
    top_model = None
    if consensus_models:
        best_name = max(consensus_models, key=lambda k: consensus_models[k]["correct"] / consensus_models[k]["total"])
        best = consensus_models[best_name]
        top_model = {"name": best_name, "accuracy_pct": round(best["correct"] / best["total"] * 100, 1)}

    # Evaluation window
    evaluation_window_days = 0
    if data_since:
        from datetime import date as date_type
        try:
            first = date_type.fromisoformat(data_since)
            today = datetime.now(timezone.utc).date()
            evaluation_window_days = (today - first).days
        except Exception:
            pass

    # Top sectors (>50 samples)
    top_sectors = [s for s in sectors if s["sample_size"] > 50][:5]

    return {
        "models": model_results,
        "status": status,
        "consensus_accuracy": consensus_acc,
        "undervalued_accuracy": uv_acc,
        "sectors": sectors,
        "data_since": data_since,
        "snapshot_count": total_snapshots,
        "trading_days": trading_days,
        "evaluation_window_days": evaluation_window_days,
        "top_model": top_model,
        "top_sectors": top_sectors,
    }


@router.get("/models")
@limiter.limit("30/minute")
async def accuracy_models(request: Request):
    """Aggregate accuracy stats per model with Wilson confidence intervals."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    rows = sb.table("accuracy_tracking") \
        .select("*") \
        .limit(50000) \
        .execute().data

    # If accuracy_tracking is empty, compute live from snapshots
    if not rows:
        live = _compute_live_accuracy(sb)
        if live:
            return {
                "models": live["models"],
                "status": live["status"],
                "consensus_accuracy": live["consensus_accuracy"],
                "undervalued_accuracy": live["undervalued_accuracy"],
                "sectors": live["sectors"],
                "data_since": live["data_since"],
                "snapshot_count": live["snapshot_count"],
            }
        return {"models": [], "status": "collecting", "consensus_accuracy": None, "undervalued_accuracy": None, "sectors": [], "data_since": None, "snapshot_count": 0}

    # Snapshot metadata
    snap_meta = sb.table("valuation_snapshots").select("snapshot_date").order("snapshot_date").limit(1).execute().data
    data_since = snap_meta[0]["snapshot_date"] if snap_meta else None

    snap_count_rows = sb.table("valuation_snapshots").select("ticker", count="exact").execute()
    snapshot_count = snap_count_rows.count if snap_count_rows.count else 0

    # Per-model aggregation
    models = {}
    consensus_total = {w[0]: 0 for w in WINDOWS}
    consensus_correct = {w[0]: 0 for w in WINDOWS}
    uv_total = 0
    uv_correct = 0
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

        # Undervalued accuracy — use best available window
        best_col = None
        for _, col in WINDOWS:
            if row.get(col) is not None:
                best_col = col
                break
        if best_col is not None and is_consensus and is_undervalued:
            uv_total += 1
            if row[best_col]:
                uv_correct += 1

        # Sector stats
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

    def sort_key(m):
        for wkey in ["6mo", "12mo", "30d", "14d"]:
            if m.get(f"accuracy_{wkey}") is not None:
                return m[f"accuracy_{wkey}"]
        return 0
    result.sort(key=sort_key, reverse=True)

    best_window = None
    for wkey, _ in WINDOWS:
        if consensus_total[wkey] > 0:
            best_window = wkey
            break
    consensus_acc = round(consensus_correct[best_window] / consensus_total[best_window] * 100, 1) if best_window and consensus_total[best_window] > 0 else None
    uv_acc = round(uv_correct / uv_total * 100, 1) if uv_total > 0 else None

    if max_samples_6mo > 20:
        status = "active"
    elif max_samples_14d > 20:
        status = "beta"
    else:
        status = "collecting"

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
        .select("*") \
        .limit(50000) \
        .execute().data

    # If accuracy_tracking is empty, compute live from snapshots
    if not rows:
        live = _compute_live_accuracy(sb)
        if live:
            return {
                "consensus_accuracy_pct": live["consensus_accuracy"],
                "undervalued_accuracy_pct": live["undervalued_accuracy"],
                "top_model": live["top_model"],
                "total_snapshots": live["snapshot_count"],
                "trading_days": live["trading_days"],
                "data_since": live["data_since"],
                "evaluation_window_days": live["evaluation_window_days"],
                "top_sectors": live["top_sectors"],
            }
        return {"consensus_accuracy_pct": None, "undervalued_accuracy_pct": None, "top_model": None, "total_snapshots": 0, "trading_days": 0, "data_since": None, "evaluation_window_days": 0, "top_sectors": []}

    # Snapshot metadata
    snap_dates = sb.table("valuation_snapshots").select("snapshot_date").execute().data
    unique_dates = sorted(set(r["snapshot_date"] for r in snap_dates)) if snap_dates else []
    data_since = unique_dates[0] if unique_dates else None
    trading_days = len(unique_dates)

    snap_count_rows = sb.table("valuation_snapshots").select("ticker", count="exact").execute()
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
        # Use best available window
        val = None
        for _, col in WINDOWS:
            val = row.get(col)
            if val is not None:
                break
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

            iv = row.get("intrinsic_value")
            price_at = row.get("price_at_snapshot")
            if iv and price_at and iv > price_at:
                uv_total += 1
                if val:
                    uv_correct += 1

            sector = row.get("sector", "Unknown")
            if sector not in sector_stats:
                sector_stats[sector] = {"total": 0, "correct": 0}
            sector_stats[sector]["total"] += 1
            if val:
                sector_stats[sector]["correct"] += 1

    consensus_acc = round(consensus_correct / consensus_total * 100, 1) if consensus_total > 0 else None
    uv_acc = round(uv_correct / uv_total * 100, 1) if uv_total > 0 else None

    top_model = None
    if model_stats:
        best_name = max(model_stats, key=lambda k: model_stats[k]["correct"] / model_stats[k]["total"] if model_stats[k]["total"] > 10 else 0)
        best = model_stats[best_name]
        if best["total"] > 10:
            top_model = {"name": best_name, "accuracy_pct": round(best["correct"] / best["total"] * 100, 1)}

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
        "data_since": models_data.get("data_since", "2026-03-14"),
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

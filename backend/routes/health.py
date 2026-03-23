"""Health check endpoint for uptime monitoring."""
from fastapi import APIRouter, Request
from datetime import datetime, timezone
import time
from rate_limit import limiter
from db import get_supabase

router = APIRouter()

_start_time = time.time()


@router.get("/health")
@limiter.limit("30/minute")
async def health_check(request: Request):
    """Public health check for uptime monitoring."""
    # Check database connectivity
    db_status = "connected"
    evs_stats = {}
    try:
        sb = get_supabase()
        if not sb:
            db_status = "error"
        else:
            result = sb.table("equity_value_scores").select("computed_at", count="exact").limit(1).execute()
            evs_stats["tickers_with_scores"] = result.count or 0
            if result.data and result.data[0].get("computed_at"):
                last_run = datetime.fromisoformat(result.data[0]["computed_at"].replace("Z", "+00:00"))
                age = (datetime.now(timezone.utc) - last_run).total_seconds() / 3600
                evs_stats["evs_pipeline_last_run"] = result.data[0]["computed_at"]
                evs_stats["evs_pipeline_age_hours"] = round(age, 1)
    except Exception:
        db_status = "error"

    status = "healthy"
    if db_status == "error":
        status = "unhealthy"
    elif evs_stats.get("evs_pipeline_age_hours", 0) > 48:
        status = "degraded"

    return {
        "status": status,
        "database": db_status,
        **evs_stats,
        "uptime_seconds": int(time.time() - _start_time),
    }

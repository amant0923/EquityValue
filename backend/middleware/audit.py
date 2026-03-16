"""
Audit logging middleware — logs every request to the api_usage_log table.

Fields logged:
- hashed_ip: SHA-256 of IP + daily salt (first 16 chars), rotates daily for privacy
- user_id: extracted from JWT Authorization header if present
- endpoint: request path
- method: HTTP method
- response_code: status code returned
- response_time_ms: round-trip latency
- timestamp: UTC ISO-8601
"""
import hashlib
import time
import threading
from datetime import datetime, timezone
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


def _daily_salt() -> str:
    """Return today's date string as the daily salt for IP hashing."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _hash_ip(ip: str) -> str:
    """Hash IP with daily salt — allows correlation within a day but not across days."""
    salted = ip + _daily_salt()
    return hashlib.sha256(salted.encode()).hexdigest()[:16]


def _extract_user_id(request: Request) -> str | None:
    """Best-effort extraction of user_id from Supabase JWT (sub claim)."""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1]
    try:
        import base64
        import json
        # Decode JWT payload (middle segment) without verification — just for logging
        payload_b64 = token.split(".")[1]
        # Fix padding
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("sub")
    except Exception:
        return None


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Fire-and-forget audit logging to Supabase api_usage_log table."""

    def __init__(self, app, supabase_client=None):
        super().__init__(app)
        self._sb = supabase_client

    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        elapsed_ms = round((time.time() - start) * 1000)

        # Don't block the response — fire and forget in a background thread
        if self._sb:
            try:
                client_ip = request.client.host if request.client else "unknown"
                log_entry = {
                    "hashed_ip": _hash_ip(client_ip),
                    "user_id": _extract_user_id(request),
                    "endpoint": request.url.path,
                    "method": request.method,
                    "response_code": response.status_code,
                    "response_time_ms": elapsed_ms,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                thread = threading.Thread(
                    target=self._write_log,
                    args=(log_entry,),
                    daemon=True,
                )
                thread.start()
            except Exception:
                pass  # Never let audit logging break a request

        return response

    def _write_log(self, entry: dict):
        """Synchronous write to Supabase — runs in background thread."""
        try:
            self._sb.table("api_usage_log").insert(entry).execute()
        except Exception as e:
            print(f"[audit] write failed: {e}")

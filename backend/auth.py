# backend/auth.py
import jwt
import logging
from fastapi import Request, HTTPException
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET

logger = logging.getLogger(__name__)

if not SUPABASE_JWT_SECRET:
    logger.warning("SUPABASE_JWT_SECRET not set — JWT verification will use Supabase API (slower)")

# Shared Supabase client — created once, reused across requests
_sb_client = None
def _get_supabase():
    global _sb_client
    if _sb_client is None and SUPABASE_URL and SUPABASE_KEY:
        _sb_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _sb_client


async def get_current_user(request: Request) -> dict:
    """Extract and verify JWT from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]

    # Try local JWT verification first (fast path)
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")

    # Fallback: verify token via Supabase API (only if JWT secret not configured)
    sb = _get_supabase()
    if sb:
        try:
            res = sb.auth.get_user(token)
            if res and res.user:
                return {
                    "sub": res.user.id,
                    "email": res.user.email,
                    "role": "authenticated",
                }
        except Exception as e:
            err_msg = str(e).lower()
            if "expired" in err_msg or "invalid" in err_msg:
                logger.info(f"Supabase auth: token rejected (expected): {e}")
                detail = "Token expired" if "expired" in err_msg else "Invalid token"
                raise HTTPException(status_code=401, detail=detail)
            logger.error(f"Supabase auth verification failed: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")

    raise HTTPException(status_code=401, detail="Auth service unavailable")


async def get_user_profile(user_id: str) -> dict:
    """Fetch user profile from Supabase to check plan and limits."""
    sb = _get_supabase()
    if not sb:
        return {"plan": "free", "analyses_today": 0}
    try:
        result = sb.table("user_profiles").select("*").eq("id", user_id).single().execute()
        return result.data if result.data else {"plan": "free", "analyses_today": 0}
    except Exception:
        return {"plan": "free", "analyses_today": 0}

# backend/auth.py
import jwt
import logging
from fastapi import Request, HTTPException
from config import SUPABASE_JWT_SECRET
from db import get_supabase

logger = logging.getLogger(__name__)

# Fix PEM key formatting: env vars often store \n as literal backslash-n
_jwt_secret = SUPABASE_JWT_SECRET
if _jwt_secret and "\\n" in _jwt_secret:
    _jwt_secret = _jwt_secret.replace("\\n", "\n")

if not _jwt_secret:
    logger.warning("SUPABASE_JWT_SECRET not set — JWT verification will use Supabase API (slower)")


def _get_supabase():
    """Use centralized Supabase client factory instead of creating a duplicate."""
    return get_supabase()


async def get_optional_user(request: Request):
    """Return user dict if a valid token is present, else None (no 401)."""
    try:
        return await get_current_user(request)
    except (HTTPException, Exception) as e:
        if isinstance(e, HTTPException):
            return None
        logger.warning("Unexpected auth error (treating as anonymous): %s", e)
        return None


async def get_current_user(request: Request) -> dict:
    """Extract and verify JWT from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]

    # Try local JWT verification first (fast path)
    if _jwt_secret:
        try:
            payload = jwt.decode(token, _jwt_secret, algorithms=["HS256", "ES256"], audience="authenticated")
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired") from None
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token") from None
        except Exception as e:
            # Catches cryptography PEM errors, key format issues, etc.
            logger.warning("JWT local decode failed (falling back to Supabase API): %s", e)

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
                raise HTTPException(status_code=401, detail=detail) from None
            logger.error(f"Supabase auth verification failed: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed") from None

    raise HTTPException(status_code=401, detail="Auth service unavailable")


async def get_user_profile(user_id: str) -> dict:
    """Fetch user profile from Supabase to check plan and limits."""
    sb = _get_supabase()
    if not sb:
        return {"plan": "trial", "analyses_today": 0}
    try:
        result = sb.table("user_profiles").select("*").eq("id", user_id).single().execute()
        return result.data if result.data else {"plan": "trial", "analyses_today": 0}
    except Exception:
        return {"plan": "trial", "analyses_today": 0}

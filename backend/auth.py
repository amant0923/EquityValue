# backend/auth.py
import os
import jwt
from fastapi import Request, HTTPException
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYnRnbnBsb3Rsc2hyd2JvdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDEzODIsImV4cCI6MjA4ODQ3NzM4Mn0.grKm3Rh-UtXU3bIz2ajLNiVxbfTECC9cwuslZe_BY-I")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


async def get_current_user(request: Request) -> dict:
    """Extract and verify JWT from Authorization header.
    Falls back to anonymous access if verification fails."""
    auth_header = request.headers.get("Authorization", "")

    # No token → anonymous user
    if not auth_header.startswith("Bearer "):
        return {"sub": "anonymous", "role": "anonymous"}

    token = auth_header.split(" ")[1]

    # Try local JWT verification first (fast path)
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            return payload
        except jwt.ExpiredSignatureError:
            pass
        except jwt.InvalidTokenError:
            pass

    # Fallback: verify token via Supabase API
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            sb = create_client(SUPABASE_URL, SUPABASE_KEY)
            res = sb.auth.get_user(token)
            if res and res.user:
                return {
                    "sub": res.user.id,
                    "email": res.user.email,
                    "role": "authenticated",
                }
        except Exception:
            pass

    # All verification failed → allow as anonymous rather than blocking
    return {"sub": "anonymous", "role": "anonymous"}


async def get_user_profile(user_id: str) -> dict:
    """Fetch user profile from Supabase to check plan and limits."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"plan": "free", "analyses_today": 0}
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    result = sb.table("user_profiles").select("*").eq("id", user_id).single().execute()
    return result.data if result.data else {"plan": "free", "analyses_today": 0}

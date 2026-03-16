"""Lifetime deal and student discount endpoints."""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import os
import stripe
from supabase import create_client
from auth import get_current_user

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_LIFETIME_PRICE_ID = os.environ.get("STRIPE_LIFETIME_PRICE_ID", "")
STUDENT_COUPON_ID = os.environ.get("STRIPE_STUDENT_COUPON_ID", "")
LIFETIME_CAP = 100

router = APIRouter(prefix="/pricing")


@router.get("/lifetime/status")
async def lifetime_status():
    """Check if lifetime deal is still available and how many are left."""
    if not sb:
        return {"available": False, "remaining": 0}
    try:
        rows = sb.table("user_profiles").select("id").eq("plan", "lifetime").execute().data or []
        sold = len(rows)
        remaining = max(0, LIFETIME_CAP - sold)
        return {"available": remaining > 0, "remaining": remaining, "price": 99, "total": LIFETIME_CAP}
    except Exception:
        return {"available": True, "remaining": LIFETIME_CAP, "price": 99, "total": LIFETIME_CAP}


@router.post("/lifetime/checkout")
async def lifetime_checkout(request: Request, user=Depends(get_current_user)):
    """Create Stripe checkout for $99 lifetime Pro deal."""
    if not stripe.api_key or not STRIPE_LIFETIME_PRICE_ID:
        raise HTTPException(503, "Lifetime deal not configured")
    # Check cap
    if sb:
        rows = sb.table("user_profiles").select("id").eq("plan", "lifetime").execute().data or []
        if len(rows) >= LIFETIME_CAP:
            raise HTTPException(410, "Lifetime deal sold out")
    try:
        session = stripe.checkout.Session.create(
            customer_email=user.get("email", ""),
            payment_method_types=["card"],
            line_items=[{"price": STRIPE_LIFETIME_PRICE_ID, "quantity": 1}],
            mode="payment",  # One-time payment, not subscription
            success_url="https://equityvalue.ai?payment=lifetime_success",
            cancel_url="https://equityvalue.ai?payment=cancelled",
            metadata={"user_id": user["sub"], "deal_type": "lifetime"},
        )
        return {"checkout_url": session.url}
    except Exception as e:
        print(f"[lifetime checkout] {e}")
        raise HTTPException(500, "Could not create checkout session")


class StudentVerify(BaseModel):
    email: str


@router.post("/student/verify")
async def verify_student(body: StudentVerify, user=Depends(get_current_user)):
    """Verify .edu email for 50% student discount."""
    email = body.email.strip().lower()
    if not email.endswith(".edu"):
        raise HTTPException(400, "Only .edu email addresses qualify for the student discount")
    # Store the verified .edu email
    if sb:
        try:
            sb.table("user_profiles").update({
                "student_email": email,
                "student_verified": True,
            }).eq("id", user["sub"]).execute()
        except Exception as e:
            print(f"[student verify] {e}")
    return {"verified": True, "discount": "50%", "coupon_id": STUDENT_COUPON_ID or "STUDENT50"}


@router.post("/student/checkout")
async def student_checkout(request: Request, user=Depends(get_current_user)):
    """Create Stripe checkout with 50% student discount applied."""
    if not stripe.api_key:
        raise HTTPException(503, "Payment not configured")
    # Verify student status
    if sb:
        profile = sb.table("user_profiles").select("student_verified").eq("id", user["sub"]).single().execute().data
        if not profile or not profile.get("student_verified"):
            raise HTTPException(400, "Please verify your .edu email first")
    body = await request.json()
    plan = body.get("plan", "pro")
    from stripe_handler import get_price_id
    price_id = get_price_id(plan)
    if not price_id:
        raise HTTPException(400, "Invalid plan")
    try:
        checkout_params = {
            "customer_email": user.get("email", ""),
            "payment_method_types": ["card"],
            "line_items": [{"price": price_id, "quantity": 1}],
            "mode": "subscription",
            "success_url": "https://equityvalue.ai?payment=student_success",
            "cancel_url": "https://equityvalue.ai?payment=cancelled",
            "metadata": {"user_id": user["sub"], "deal_type": "student"},
        }
        # Apply coupon if configured
        if STUDENT_COUPON_ID:
            checkout_params["discounts"] = [{"coupon": STUDENT_COUPON_ID}]
        session = stripe.checkout.Session.create(**checkout_params)
        return {"checkout_url": session.url}
    except Exception as e:
        print(f"[student checkout] {e}")
        raise HTTPException(500, "Could not create checkout session")

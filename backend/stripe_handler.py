# backend/stripe_handler.py
import os
import stripe

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or None
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

import logging as _logging
_stripe_logger = _logging.getLogger(__name__)
if not stripe.api_key:
    _stripe_logger.warning("STRIPE_SECRET_KEY not set — all checkout requests will fail")
elif stripe.api_key.startswith("pk_"):
    _stripe_logger.error("STRIPE_SECRET_KEY contains a PUBLISHABLE key (pk_...) — must be a SECRET key (sk_...)")
elif not stripe.api_key.startswith("sk_"):
    _stripe_logger.warning("STRIPE_SECRET_KEY doesn't start with sk_ — verify it's the correct secret key")
if not STRIPE_WEBHOOK_SECRET:
    _stripe_logger.warning("STRIPE_WEBHOOK_SECRET not set — webhook signature verification will fail")

PLAN_PRICE_IDS = {
    "pro": os.environ.get("STRIPE_PRO_PRICE_ID", ""),
    "pro_annual": os.environ.get("STRIPE_PRO_ANNUAL_PRICE_ID", ""),
    "lifetime": os.environ.get("STRIPE_MAX_PRICE_ID", ""),
    "lifetime_annual": os.environ.get("STRIPE_MAX_ANNUAL_PRICE_ID", ""),
}


def get_price_id(plan: str) -> str:
    return PLAN_PRICE_IDS.get(plan, "")


def price_id_to_plan(price_id: str) -> str:
    for plan, pid in PLAN_PRICE_IDS.items():
        if pid and pid == price_id:
            # Strip _annual suffix — both monthly and annual map to same plan
            return plan.replace("_annual", "")
    return "pro"


def create_checkout_session(user_id: str, user_email: str, plan: str, success_url: str, cancel_url: str):
    price_id = get_price_id(plan)
    if not price_id:
        raise ValueError(f"No price ID configured for plan: {plan}")
    session = stripe.checkout.Session.create(
        customer_email=user_email,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user_id},
    )
    return session


def handle_webhook_event(payload: bytes, sig_header: str):
    event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    return event

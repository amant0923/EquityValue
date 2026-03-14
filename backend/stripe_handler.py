# backend/stripe_handler.py
import os
import stripe

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

PLAN_PRICE_IDS = {
    "pro": os.environ.get("STRIPE_PRO_PRICE_ID", ""),
    "pro_annual": os.environ.get("STRIPE_PRO_ANNUAL_PRICE_ID", ""),
    "max": os.environ.get("STRIPE_MAX_PRICE_ID", ""),
    "max_annual": os.environ.get("STRIPE_MAX_ANNUAL_PRICE_ID", ""),
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

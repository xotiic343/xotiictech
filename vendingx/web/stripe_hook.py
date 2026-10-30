"""Stripe checkout + webhook handler.

Creates a $3 one-time checkout session and verifies webhook signatures
to grant access on successful payment.
"""

from __future__ import annotations

import logging
import os

import stripe
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from bot.db import get_db
from bot.access import grant_payment

log = logging.getLogger("vendingx.web.stripe")

router = APIRouter(prefix="/stripe", tags=["stripe"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://xotiictech.net")


@router.post("/create-checkout")
async def create_checkout(request: Request) -> JSONResponse:
    """Create a Stripe checkout session for $3 one-time access."""
    session_id = request.cookies.get("vx_session")
    if not session_id:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    db = get_db()
    row = db.execute("SELECT user_id FROM web_sessions WHERE session_id = ?", (session_id,)).fetchone()
    if not row:
        return JSONResponse({"error": "Invalid session"}, status_code=401)

    user_id = row[0]

    try:
        checkout = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": PRICE_ID, "quantity": 1}],
            success_url=f"{FRONTEND_URL}/vendingx/?payment=success",
            cancel_url=f"{FRONTEND_URL}/vendingx/?payment=cancel",
            metadata={"discord_user_id": str(user_id)},
        )
    except stripe.StripeError as e:
        log.error("Stripe checkout creation failed: %s", e)
        return JSONResponse({"error": "Payment setup failed"}, status_code=500)

    db.execute(
        "INSERT INTO stripe_payments (user_id, stripe_session_id, amount, status) VALUES (?, ?, 300, 'pending')",
        (user_id, checkout.id),
    )
    db.commit()

    return JSONResponse({"url": checkout.url})


@router.post("/webhook")
async def webhook(request: Request) -> JSONResponse:
    """Handle Stripe webhook events with signature verification."""
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(body, sig, WEBHOOK_SECRET)
    except (stripe.SignatureVerificationError, ValueError) as e:
        log.warning("Stripe webhook signature invalid: %s", e)
        return JSONResponse({"error": "Invalid signature"}, status_code=400)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id_str = session.get("metadata", {}).get("discord_user_id")
        if user_id_str:
            user_id = int(user_id_str)
            db = get_db()
            db.execute(
                "UPDATE stripe_payments SET status = 'completed' WHERE stripe_session_id = ?",
                (session["id"],),
            )
            db.commit()
            grant_payment(db, user_id)
            log.info("Payment completed for user %s", user_id)

    return JSONResponse({"ok": True})

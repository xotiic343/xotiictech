import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

const STRIPE_SECRET = process.env.VENDINGX_STRIPE_SECRET_KEY || "";
const FRONTEND_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://xotiictech.net";
const PREMIUM_PRICE_ID = process.env.VENDINGX_PREMIUM_PRICE_ID || "";

export async function GET(request: Request) {
  if (!STRIPE_SECRET || !PREMIUM_PRICE_ID) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const sessionRes = await fetch(`${FRONTEND_URL}/support/api/auth/session`, {
    headers: { cookie: request.headers.get("cookie") || "" },
  });
  let discordId: string | null = null;
  if (sessionRes.ok) {
    const data = await sessionRes.json();
    discordId = data?.user?.discordId ?? null;
  }

  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": PREMIUM_PRICE_ID,
    "line_items[0][quantity]": "1",
    success_url: `${FRONTEND_URL}/vendingx?payment=success`,
    cancel_url: `${FRONTEND_URL}/vendingx?payment=cancel`,
  });
  if (discordId) {
    body.append("metadata[discord_user_id]", discordId);
    body.append("metadata[product]", "premium");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }

  const session = await res.json();
  redirect(session.url);
}

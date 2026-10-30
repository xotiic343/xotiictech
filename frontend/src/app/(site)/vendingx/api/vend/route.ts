import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "https://xotiictech-api.onrender.com";
const FRONTEND_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://xotiictech.net";

export async function POST(request: Request) {
  const sessionRes = await fetch(`${FRONTEND_URL}/support/api/auth/session`, {
    headers: { cookie: request.headers.get("cookie") || "" },
  });
  if (!sessionRes.ok) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const session = await sessionRes.json();
  const userId = session?.user?.discordId;
  const username = session?.user?.globalName || session?.user?.username || "";
  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  let body: { stock_key?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.stock_key) {
    return NextResponse.json({ error: "Missing stock_key" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/vendingx/vend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stock_key: body.stock_key,
        user_id: userId,
        username,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || "Vend failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }
}

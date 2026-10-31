import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/support/ratelimit";
import { getVendUser, vendApi } from "@/lib/vendingx";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getVendUser();
  if (!user) return NextResponse.json({ error: "Log in with Discord to vend" }, { status: 401 });

  const limited = rateLimit(`vx-vend:${user.discordId}`, 6, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: `Slow down: try again in ${limited.retryAfterSec}s` }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { stock_key?: unknown } | null;
  const stockKey = typeof body?.stock_key === "string" ? body.stock_key.slice(0, 80) : "";
  if (!stockKey) return NextResponse.json({ error: "Pick an item first" }, { status: 400 });

  try {
    const res = await vendApi("/vend", {
      stock_key: stockKey,
      user_id: user.discordId,
      username: user.globalName || user.username,
      premium: user.premium,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = res.status === 403 && data.detail === "Invalid bot secret"
        ? "Vending is not configured yet"
        : data.detail || "Vend failed";
      return NextResponse.json({ error }, { status: res.status === 403 && error.startsWith("Vending") ? 503 : res.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Vending machine is offline, try again shortly" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1344385779627069541";
const PREMIUM_ROLE_ID = process.env.PREMIUM_ROLE_ID || "1474136325912399994";
const DISCORD_API = "https://discord.com/api/v10";

export async function GET(request: Request) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ premium: false });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ premium: false });
  }

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/members/${userId}`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
    });
    if (!res.ok) return NextResponse.json({ premium: false });

    const member = await res.json();
    const premium = Array.isArray(member.roles) && member.roles.includes(PREMIUM_ROLE_ID);
    return NextResponse.json({ premium });
  } catch {
    return NextResponse.json({ premium: false });
  }
}

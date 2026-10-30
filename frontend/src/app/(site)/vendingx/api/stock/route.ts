import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "https://xotiictech-api.onrender.com";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/vendingx/stock`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return NextResponse.json({});
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({});
  }
}

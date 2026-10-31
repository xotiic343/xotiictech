import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/backend";

export async function GET() {
  try {
    const res = await fetch(`${backendUrl()}/api/vendingx/stock`, {
      next: { revalidate: 10 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({}, { status: 502 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({}, { status: 502 });
  }
}

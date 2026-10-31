import { NextResponse } from "next/server";
import { getVendUser } from "@/lib/vendingx";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getVendUser();
  return NextResponse.json({ user }, { headers: { "cache-control": "no-store" } });
}

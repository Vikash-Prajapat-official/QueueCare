import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public on purpose: used by the Docker healthcheck and the /health page.
// Returns only up/down status, never patient or staff data.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up" });
  } catch {
    return NextResponse.json({ status: "error", database: "down" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { enforce, enforceIp } from "@/lib/public-limits";
import { getTokenStatusByCode } from "@/lib/queue-service";

// PUBLIC on purpose (patients check their phone): GET /api/tokens/:code/status
// The [id] segment holds the 8-character public code here (Next.js needs one name per level).
// The answer has no names or phone numbers. The code itself is the secret.
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id: code } = await ctx.params;
  // The status page asks every 5 seconds, so 60 a minute per code is normal and 120 per visitor is generous.
  enforceIp(req.headers, "status", 120, 60_000, "status requests");
  enforce(`status-code:${code.toUpperCase()}`, 60, 60_000, "status requests");
  return NextResponse.json(await getTokenStatusByCode(code.toUpperCase()));
});

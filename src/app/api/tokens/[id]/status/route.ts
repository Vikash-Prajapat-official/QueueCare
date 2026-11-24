import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getTokenStatusByCode } from "@/lib/queue-service";

// PUBLIC on purpose (patients check their phone): GET /api/tokens/:code/status
// The [id] segment holds the 8-character public code here (Next.js needs one name per level).
// The answer has no names or phone numbers. The code itself is the secret.
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id: code } = await ctx.params;
  return NextResponse.json(await getTokenStatusByCode(code.toUpperCase()));
});

import { NextResponse } from "next/server";
import { readJson, requireRole, route } from "@/lib/api";
import { createTokenSchema } from "@/lib/queue-schemas";
import { createToken } from "@/lib/queue-service";

// Create a token at the registration desk.
export const POST = route(async (req: Request) => {
  const actor = await requireRole(["CLERK", "ADMIN"]);
  const input = createTokenSchema.parse(await readJson(req));
  return NextResponse.json({ token: await createToken(input, actor, req) }, { status: 201 });
});

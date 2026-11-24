import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { checkInSchema, selfCheckIn } from "@/lib/checkin-service";
import { enforceIp } from "@/lib/public-limits";

// PUBLIC on purpose (patients scan the QR poster). Limits: 5 per phone per day and 30 per IP
// per hour, both enforced in selfCheckIn. The answer is only the public token code.
export const POST = route(async (req: Request) => {
  enforceIp(req.headers, "checkin", 10, 60_000, "check-in attempts"); // a short burst limit on top of the daily ones
  const input = checkInSchema.parse(await readJson(req));
  const result = await selfCheckIn(input, req);
  return NextResponse.json(result, { status: result.existing ? 200 : 201 });
});

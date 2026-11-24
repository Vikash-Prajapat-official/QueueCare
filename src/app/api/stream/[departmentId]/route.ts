import { ApiError, requireRole, route } from "@/lib/api";
import { db } from "@/lib/db";
import { isValidDisplayKey, parseDepartmentIds } from "@/lib/display";
import { enforceIp } from "@/lib/public-limits";
import { ROLES } from "@/lib/rbac";
import { subscribeQueue } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;

// Server-Sent Events: GET /api/stream/<departmentId>[,<departmentId>...][?key=<DISPLAY_KEY>]
// Allowed for a valid display key (TV screens) or any logged-in user. Events say only that
// "something changed" plus a token label; screens then reload their own state.
export const GET = route(async (req: Request, ctx: { params: Promise<{ departmentId: string }> }) => {
  const { departmentId } = await ctx.params;
  const ids = parseDepartmentIds(departmentId);
  if (!ids) throw new ApiError(400, "VALIDATION", "Invalid department list.");

  const key = new URL(req.url).searchParams.get("key");
  if (!isValidDisplayKey(key)) {
    if (key) enforceIp(req.headers, "display-key", 20, 60_000, "wrong display keys"); // stops key guessing
    await requireRole(ROLES);
  }

  const found = await db.department.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new ApiError(404, "NOT_FOUND", "Department not found.");

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const write = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup(); // the client has gone
        }
      };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      write("retry: 3000\n\n");
      send("ready", { departments: ids });

      const unsubscribe = subscribeQueue(ids, (departmentId, message) => send("queue", { departmentId, ...message }));
      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        cleanup = () => {};
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform stops proxies and compression from buffering the stream
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

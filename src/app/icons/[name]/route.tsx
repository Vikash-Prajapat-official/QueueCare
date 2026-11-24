import { ImageResponse } from "next/og";

// App icons drawn on request (no image files to keep in the repository):
//   /icons/192.png  /icons/512.png  /icons/maskable-512.png  /icons/apple-180.png
const SIZES: Record<string, { size: number; maskable: boolean }> = {
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
  "apple-180.png": { size: 180, maskable: true },
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const spec = SIZES[(await params).name];
  if (!spec) return new Response("Not found", { status: 404 });
  const { size, maskable } = spec;
  // Maskable icons keep the picture inside the central 80% so any round or square crop works.
  const inner = maskable ? size * 0.5 : size * 0.62;
  const dot = inner / 5;
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F766E",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        {/* A line of people waiting; the first one is called (white, larger). */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: dot * 0.6, width: inner, justifyContent: "center" }}>
          <div style={{ width: dot * 1.9, height: dot * 3.4, borderRadius: dot, background: "#ffffff", display: "flex" }} />
          <div style={{ width: dot * 1.3, height: dot * 2.4, borderRadius: dot, background: "#99f6e4", display: "flex" }} />
          <div style={{ width: dot * 1.3, height: dot * 2.4, borderRadius: dot, background: "#5eead4", display: "flex" }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}

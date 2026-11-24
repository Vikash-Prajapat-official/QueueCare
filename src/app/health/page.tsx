import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function check() {
  try {
    await db.$queryRaw`SELECT 1`;
    const [departments, users, tokens] = await Promise.all([
      db.department.count(),
      db.user.count(),
      db.token.count(),
    ]);
    return { ok: true as const, departments, users, tokens };
  } catch {
    return { ok: false as const };
  }
}

// Shows only up/down status and row counts. No names or phone numbers.
export default async function HealthPage() {
  const r = await check();
  return (
    <main className="mx-auto max-w-xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>QueueCare health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            App: <strong className="text-primary">running</strong>
          </p>
          <p>
            Database:{" "}
            <strong className={r.ok ? "text-primary" : "text-destructive"}>
              {r.ok ? "connected" : "unreachable"}
            </strong>
          </p>
          {r.ok && (
            <p className="text-sm text-muted-foreground">
              {r.departments} departments, {r.users} users, {r.tokens} tokens
              {r.departments === 0 && ". Run the seed to load demo data."}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

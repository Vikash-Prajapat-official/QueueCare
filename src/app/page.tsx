import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder. The real landing page is built in Phase 6.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-4xl font-bold text-primary">QueueCare</h1>
      <p className="text-muted-foreground">Free, open-source OPD token and queue system.</p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/login">Staff login</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/health">System health</Link>
        </Button>
      </div>
    </main>
  );
}

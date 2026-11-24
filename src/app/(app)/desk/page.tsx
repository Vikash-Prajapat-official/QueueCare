import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/page-auth";

export const metadata = { title: "Desk · QueueCare" };

export default async function DeskPage() {
  const user = await requirePageRole(["ADMIN", "CLERK"]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration desk</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Welcome, {user.name}. Token creation and today&apos;s queues arrive in Phase 3.
      </CardContent>
    </Card>
  );
}

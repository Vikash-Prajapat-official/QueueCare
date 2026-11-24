import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/page-auth";

export const metadata = { title: "Doctor console · QueueCare" };

export default async function DoctorPage() {
  const user = await requirePageRole(["DOCTOR"]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Doctor console</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Welcome, {user.name}. The Next, Skip, Recall and Complete buttons arrive in Phase 3.
      </CardContent>
    </Card>
  );
}

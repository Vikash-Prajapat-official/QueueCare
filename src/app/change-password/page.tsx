import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/page-auth";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Change password · QueueCare" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Fchange-password");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-3xl font-bold text-primary">QueueCare</h1>
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm forced={user.mustChangePassword} />
        </CardContent>
      </Card>
    </main>
  );
}

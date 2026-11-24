import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/language-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/page-auth";
import { ChangePasswordForm } from "./change-password-form";

export async function generateMetadata() {
  return { title: (await getTranslations("changePassword"))("metaTitle") };
}

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Fchange-password");
  const t = await getTranslations("changePassword");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex justify-end text-primary">
        <LanguageToggle tone="light" />
      </div>
      <h1 className="text-center text-3xl font-bold text-primary">QueueCare</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm forced={user.mustChangePassword} />
        </CardContent>
      </Card>
    </main>
  );
}

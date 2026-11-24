import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/language-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  return { title: (await getTranslations("login"))("metaTitle") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; changed?: string }>;
}) {
  const { callbackUrl, changed } = await searchParams;
  const t = await getTranslations("login");
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
          <LoginForm callbackUrl={callbackUrl ?? ""} passwordChanged={changed === "1"} />
        </CardContent>
      </Card>
    </main>
  );
}

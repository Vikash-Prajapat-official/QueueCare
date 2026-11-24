import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in · QueueCare" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; changed?: string }>;
}) {
  const { callbackUrl, changed } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-3xl font-bold text-primary">QueueCare</h1>
      <Card>
        <CardHeader>
          <CardTitle>Staff login</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={callbackUrl ?? ""} passwordChanged={changed === "1"} />
        </CardContent>
      </Card>
    </main>
  );
}

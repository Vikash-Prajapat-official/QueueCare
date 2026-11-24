import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import type { Role } from "@/lib/rbac";

type NavKey =
  | "overview" | "departments" | "rooms" | "doctors" | "sessions" | "users" | "reports" | "audit"
  | "privacy" | "poster" | "newToken" | "queues" | "doctorConsole";

const NAV: Record<Role, { href: string; key: NavKey }[]> = {
  ADMIN: [
    { href: "/admin", key: "overview" },
    { href: "/admin/departments", key: "departments" },
    { href: "/admin/rooms", key: "rooms" },
    { href: "/admin/doctors", key: "doctors" },
    { href: "/admin/sessions", key: "sessions" },
    { href: "/admin/users", key: "users" },
    { href: "/admin/reports", key: "reports" },
    { href: "/admin/audit", key: "audit" },
    { href: "/admin/privacy", key: "privacy" },
    { href: "/admin/poster", key: "poster" },
    { href: "/desk", key: "newToken" },
    { href: "/desk/queues", key: "queues" },
  ],
  CLERK: [
    { href: "/desk", key: "newToken" },
    { href: "/desk/queues", key: "queues" },
  ],
  DOCTOR: [{ href: "/doctor", key: "doctorConsole" }],
};

export async function AppHeader({ name, role }: { name: string; role: Role }) {
  const t = await getTranslations();
  return (
    <header className="border-b border-border bg-primary text-primary-foreground print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold">
          QueueCare
        </Link>
        <nav aria-label={t("nav.main")} className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
          {NAV[role].map((item) => (
            <Link key={item.href} href={item.href} className="underline-offset-4 hover:underline">
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <LanguageToggle />
          <span>
            {name} <span className="opacity-80">({t(`roles.${role}`)})</span>
          </span>
          <Link href="/change-password" className="underline-offset-4 hover:underline">
            {t("common.changePassword")}
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" size="sm" variant="outline" className="text-foreground">
              {t("common.logOut")}
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

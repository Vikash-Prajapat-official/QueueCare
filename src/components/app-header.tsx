import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import type { Role } from "@/lib/rbac";

const NAV: Record<Role, { href: string; label: string }[]> = {
  ADMIN: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/departments", label: "Departments" },
    { href: "/admin/rooms", label: "Rooms" },
    { href: "/admin/doctors", label: "Doctors" },
    { href: "/admin/sessions", label: "Sessions" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/audit", label: "Audit log" },
    { href: "/admin/privacy", label: "Privacy" },
    { href: "/admin/poster", label: "Poster & TV" },
    { href: "/desk", label: "New token" },
    { href: "/desk/queues", label: "Queues" },
  ],
  CLERK: [
    { href: "/desk", label: "New token" },
    { href: "/desk/queues", label: "Queues" },
  ],
  DOCTOR: [{ href: "/doctor", label: "Doctor console" }],
};

export function AppHeader({ name, role }: { name: string; role: Role }) {
  return (
    <header className="border-b border-border bg-primary text-primary-foreground print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold">
          QueueCare
        </Link>
        <nav aria-label="Main" className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
          {NAV[role].map((item) => (
            <Link key={item.href} href={item.href} className="underline-offset-4 hover:underline">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span>
            {name} <span className="opacity-80">({role.toLowerCase()})</span>
          </span>
          <Link href="/change-password" className="underline-offset-4 hover:underline">
            Change password
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" size="sm" variant="outline" className="text-foreground">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

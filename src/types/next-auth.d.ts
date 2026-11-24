import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/rbac";

declare module "next-auth" {
  interface User {
    role: Role;
    mustChangePassword: boolean;
    departmentId: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
      departmentId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    mustChangePassword: boolean;
    departmentId: string | null;
  }
}

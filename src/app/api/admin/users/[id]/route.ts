import { itemHandlers } from "@/lib/admin/handlers";
import { users } from "@/lib/admin/entities";

export const { PATCH, DELETE } = itemHandlers(users);

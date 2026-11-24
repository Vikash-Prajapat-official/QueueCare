import { itemHandlers } from "@/lib/admin/handlers";
import { sessions } from "@/lib/admin/entities";

export const { PATCH, DELETE } = itemHandlers(sessions);

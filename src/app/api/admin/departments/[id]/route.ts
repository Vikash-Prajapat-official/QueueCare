import { itemHandlers } from "@/lib/admin/handlers";
import { departments } from "@/lib/admin/entities";

export const { PATCH, DELETE } = itemHandlers(departments);

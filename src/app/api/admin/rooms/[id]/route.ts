import { itemHandlers } from "@/lib/admin/handlers";
import { rooms } from "@/lib/admin/entities";

export const { PATCH, DELETE } = itemHandlers(rooms);

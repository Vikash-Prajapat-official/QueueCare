import { itemHandlers } from "@/lib/admin/handlers";
import { doctors } from "@/lib/admin/entities";

export const { PATCH, DELETE } = itemHandlers(doctors);

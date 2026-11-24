import { collectionHandlers } from "@/lib/admin/handlers";
import { departments } from "@/lib/admin/entities";

export const { GET, POST } = collectionHandlers(departments);

import { collectionHandlers } from "@/lib/admin/handlers";
import { rooms } from "@/lib/admin/entities";

export const { GET, POST } = collectionHandlers(rooms);

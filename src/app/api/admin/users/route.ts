import { collectionHandlers } from "@/lib/admin/handlers";
import { users } from "@/lib/admin/entities";

export const { GET, POST } = collectionHandlers(users);

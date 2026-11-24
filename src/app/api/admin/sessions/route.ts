import { collectionHandlers } from "@/lib/admin/handlers";
import { sessions } from "@/lib/admin/entities";

export const { GET, POST } = collectionHandlers(sessions);

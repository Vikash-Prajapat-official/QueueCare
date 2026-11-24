import { collectionHandlers } from "@/lib/admin/handlers";
import { doctors } from "@/lib/admin/entities";

export const { GET, POST } = collectionHandlers(doctors);

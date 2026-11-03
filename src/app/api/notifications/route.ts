import { apiSuccess } from "@/lib/api/response";
import { mongoUnavailable } from "@/lib/api/mongodb";
import { requireApiRole } from "@/lib/auth/api";
import {
  getUnreadNotificationCount,
  listNotifications,
} from "@/lib/repositories/mongo-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Creator", "Brand", "Admin");
  if (actor.error) return actor.error;

  try {
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(actor.user.userId, actor.user.role, false, 50),
      getUnreadNotificationCount(actor.user.userId, actor.user.role),
    ]);
    return apiSuccess({ notifications, unreadCount });
  } catch (error) {
    return mongoUnavailable(error, "Notifications could not be loaded");
  }
}

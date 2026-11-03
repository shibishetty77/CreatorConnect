import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { mongoUnavailable } from "@/lib/api/mongodb";
import { requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  markNotificationRead,
  parseObjectId,
} from "@/lib/repositories/mongo-platform";
import { mongoIdParamSchema } from "@/lib/validations/mongo-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ notificationId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request, { requireJson: false });
  if (guard) return guard;

  const actor = await requireApiRole("Creator", "Brand", "Admin");
  if (actor.error) return actor.error;

  const { notificationId } = await context.params;
  const parsed = mongoIdParamSchema.safeParse(notificationId);
  if (!parsed.success) {
    return apiError(400, "INVALID_NOTIFICATION_ID", "The notification ID is invalid.");
  }

  try {
    const id = parseObjectId(parsed.data);
    if (!id) {
      return apiError(400, "INVALID_NOTIFICATION_ID", "The notification ID is invalid.");
    }
    const updated = await markNotificationRead(
      actor.user.userId,
      actor.user.role,
      id,
    );
    if (!updated) {
      return apiError(404, "NOTIFICATION_NOT_FOUND", "This notification could not be found.");
    }
    return apiSuccess({ notificationId: parsed.data, isRead: true });
  } catch (error) {
    return mongoUnavailable(error, "Notification could not be marked read");
  }
}

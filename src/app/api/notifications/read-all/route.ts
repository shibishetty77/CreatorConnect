import type { NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api/response";
import { mongoUnavailable } from "@/lib/api/mongodb";
import { requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { markAllNotificationsRead } from "@/lib/repositories/mongo-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = mutationGuard(request, { requireJson: false });
  if (guard) return guard;

  const actor = await requireApiRole("Creator", "Brand", "Admin");
  if (actor.error) return actor.error;

  try {
    const updatedCount = await markAllNotificationsRead(
      actor.user.userId,
      actor.user.role,
    );
    return apiSuccess({ updatedCount });
  } catch (error) {
    return mongoUnavailable(error, "Notifications could not be marked read");
  }
}

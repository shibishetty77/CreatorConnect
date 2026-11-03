import { apiError, apiSuccess } from "@/lib/api/response";
import { mongoUnavailable } from "@/lib/api/mongodb";
import { requireApiRole } from "@/lib/auth/api";
import { listActivity } from "@/lib/repositories/mongo-platform";
import { activityLimitSchema } from "@/lib/validations/mongo-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await requireApiRole("Creator", "Brand", "Admin");
  if (actor.error) return actor.error;

  const parsedLimit = activityLimitSchema.safeParse(
    new URL(request.url).searchParams.get("limit") ?? undefined,
  );
  if (!parsedLimit.success) {
    return apiError(
      400,
      "INVALID_LIMIT",
      "Activity limit must be between 1 and 100.",
    );
  }

  try {
    const activities = await listActivity({
      actorId: actor.user.role === "Admin" ? undefined : actor.user.userId,
      limit: parsedLimit.data,
    });
    return apiSuccess({ activities });
  } catch (error) {
    return mongoUnavailable(error, "Activity could not be loaded");
  }
}

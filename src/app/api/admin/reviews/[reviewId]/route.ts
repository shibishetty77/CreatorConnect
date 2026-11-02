import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { financeApiError } from "@/lib/api/finance";
import { requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { deleteReview } from "@/lib/repositories/finance";
import { financeIdParamSchema } from "@/lib/validations/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reviewId: string }> };

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const guard = mutationGuard(request, { requireJson: false });
  if (guard) return guard;

  const actor = await requireApiRole("Admin");
  if (actor.error) return actor.error;

  const { reviewId: rawId } = await context.params;
  const parsedId = financeIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return apiError(400, "INVALID_REVIEW_ID", "The review ID is invalid.");
  }

  try {
    await deleteReview(parsedId.data);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return financeApiError(error, "Admin review moderation failed");
  }
}

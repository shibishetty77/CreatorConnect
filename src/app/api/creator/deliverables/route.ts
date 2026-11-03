import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { deliveryApiError } from "@/lib/api/delivery";
import { listCreatorDeliverablesPage } from "@/lib/repositories/delivery";
import { zodFieldErrors } from "@/lib/validations/auth";
import { creatorDeliverableQuerySchema } from "@/lib/validations/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }
  if (!actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  const rawQuery: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (value !== "") {
      rawQuery[key] = value;
    }
  }

  const parsed = creatorDeliverableQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_FILTERS",
      "Please correct the delivery filters.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const page = await listCreatorDeliverablesPage(
      actor.user.creatorProfile.creatorId,
      parsed.data,
    );
    return apiSuccess(page);
  } catch (error) {
    return deliveryApiError(
      error,
      "Creator delivery workspace could not be loaded",
    );
  }
}

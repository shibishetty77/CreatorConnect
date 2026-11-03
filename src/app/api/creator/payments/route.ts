import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { financeApiError } from "@/lib/api/finance";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { listCreatorPaymentsPage } from "@/lib/repositories/finance";
import { zodFieldErrors } from "@/lib/validations/auth";
import { creatorPaymentQuerySchema } from "@/lib/validations/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const actor = await requireApiRole("Creator");
  if (actor.error) return actor.error;
  if (!actor.user.creatorProfile) return missingProfileError("Creator");

  const rawQuery: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (value !== "") {
      rawQuery[key] = value;
    }
  }

  const parsed = creatorPaymentQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_FILTERS",
      "Please correct the payment filters.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const page = await listCreatorPaymentsPage(
      actor.user.creatorProfile.creatorId,
      parsed.data,
    );
    return apiSuccess(page);
  } catch (error) {
    return financeApiError(error, "Creator payment history could not be loaded");
  }
}

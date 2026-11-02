import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { deliveryApiError } from "@/lib/api/delivery";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  createContract,
  getContractForParty,
  updateContract,
} from "@/lib/repositories/delivery";
import {
  contractDatesSchema,
  deliveryIdParamSchema,
} from "@/lib/validations/delivery";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ collaborationId: string }> };

async function parseRequest(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request);
  if (guard) return { response: guard } as const;

  const actor = await requireApiRole("Brand");
  if (actor.error) return { response: actor.error } as const;
  if (!actor.user.brandProfile) {
    return { response: missingProfileError("Brand") } as const;
  }

  const { collaborationId: rawId } = await context.params;
  const parsedId = deliveryIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return {
      response: apiError(
        400,
        "INVALID_COLLABORATION_ID",
        "The collaboration ID is invalid.",
      ),
    } as const;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      response: apiError(400, "INVALID_JSON", "The request body is not valid JSON."),
    } as const;
  }
  const parsedBody = contractDatesSchema.safeParse(body);
  if (!parsedBody.success) {
    return {
      response: apiError(
        400,
        "VALIDATION_ERROR",
        "Please correct the contract dates.",
        zodFieldErrors(parsedBody.error),
      ),
    } as const;
  }

  return {
    actor,
    collaborationId: parsedId.data,
    input: parsedBody.data,
  } as const;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const parsed = await parseRequest(request, context);
  if ("response" in parsed) return parsed.response;

  try {
    await createContract(
      parsed.actor.user.brandProfile!.brandId,
      parsed.collaborationId,
      parsed.input,
    );
    const contract = await getContractForParty({
      collaborationId: parsed.collaborationId,
      role: "Brand",
      profileId: parsed.actor.user.brandProfile!.brandId,
    });
    return apiSuccess({ contract }, 201);
  } catch (error) {
    return deliveryApiError(error, "Brand contract creation failed");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const parsed = await parseRequest(request, context);
  if ("response" in parsed) return parsed.response;

  try {
    await updateContract(
      parsed.actor.user.brandProfile!.brandId,
      parsed.collaborationId,
      parsed.input,
    );
    const contract = await getContractForParty({
      collaborationId: parsed.collaborationId,
      role: "Brand",
      profileId: parsed.actor.user.brandProfile!.brandId,
    });
    return apiSuccess({ contract });
  } catch (error) {
    return deliveryApiError(error, "Brand contract update failed");
  }
}

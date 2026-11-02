import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api/response";

const MAX_JSON_BODY_BYTES = 32 * 1024;

type MutationGuardOptions = {
  requireJson?: boolean;
};

export function mutationGuard(
  request: NextRequest,
  options: MutationGuardOptions = {},
): ReturnType<typeof apiError> | null {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return apiError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "The request origin is not allowed.",
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
  }

  const requireJson = options.requireJson ?? true;

  if (requireJson) {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

    if (!contentType.startsWith("application/json")) {
      return apiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "This endpoint requires an application/json request body.",
      );
    }
  }

  return null;
}

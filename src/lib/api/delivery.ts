import { apiError } from "@/lib/api/response";
import { DeliveryError } from "@/lib/repositories/delivery";

export function deliveryApiError(
  error: unknown,
  operation: string,
): ReturnType<typeof apiError> {
  if (error instanceof DeliveryError) {
    const status = error.code.endsWith("_NOT_FOUND") ? 404 : 409;
    return apiError(status, error.code, error.message);
  }

  console.error(
    `${operation}:`,
    error instanceof Error ? error.message : "Unknown error",
  );
  return apiError(
    500,
    "DELIVERY_OPERATION_FAILED",
    "We could not complete this delivery workspace request. Please try again.",
  );
}

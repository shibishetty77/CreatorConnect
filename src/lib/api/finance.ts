import { apiError } from "@/lib/api/response";
import { FinanceError } from "@/lib/repositories/finance";

export function financeApiError(
  error: unknown,
  operation: string,
): ReturnType<typeof apiError> {
  if (error instanceof FinanceError) {
    const status = error.code.endsWith("_NOT_FOUND")
      ? 404
      : error.code === "PAYMENT_AMOUNT_MISMATCH"
        ? 422
        : 409;
    return apiError(status, error.code, error.message);
  }

  console.error(
    `${operation}:`,
    error instanceof Error ? error.message : "Unknown error",
  );
  return apiError(
    500,
    "FINANCE_OPERATION_FAILED",
    "We could not complete this finance request. Please try again.",
  );
}

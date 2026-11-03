import { apiError } from "@/lib/api/response";

export function mongoUnavailable(error: unknown, context: string) {
  const message =
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable: MONGODB_")
      ? error.message
      : "MongoDB is unavailable. Check MONGODB_URI and the MongoDB server.";
  console.error(
    `${context}:`,
    error instanceof Error ? error.name : "Unknown error",
  );
  return apiError(503, "MONGODB_UNAVAILABLE", message);
}

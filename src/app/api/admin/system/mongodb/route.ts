import { apiSuccess } from "@/lib/api/response";
import { mongoUnavailable } from "@/lib/api/mongodb";
import { requireApiRole } from "@/lib/auth/api";
import { checkMongoConnection } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Admin");
  if (actor.error) return actor.error;

  try {
    return apiSuccess(await checkMongoConnection());
  } catch (error) {
    return mongoUnavailable(error, "MongoDB health check failed");
  }
}

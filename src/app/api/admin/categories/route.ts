import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { createAdminCategory, listAdminCategories } from "@/lib/repositories/admin-categories";
import { adminCategorySchema } from "@/lib/validations/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MysqlError = { code?: unknown };

function isDuplicate(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    (error as MysqlError).code === "ER_DUP_ENTRY";
}

export async function GET() {
  const actor = await requireApiRole("Admin");
  if (actor.error) return actor.error;

  try {
    return apiSuccess({ categories: await listAdminCategories() });
  } catch (error) {
    console.error("Admin category list could not be loaded:", error);
    return apiError(500, "CATEGORY_LIST_FAILED", "Categories could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  const guard = mutationGuard(request);
  if (guard) return guard;
  const actor = await requireApiRole("Admin");
  if (actor.error) return actor.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const parsed = adminCategorySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "INVALID_CATEGORY", "Enter a category name of 1 to 100 characters.", {
      categoryName: "Enter a category name of 1 to 100 characters.",
    });
  }

  try {
    return apiSuccess({ category: await createAdminCategory(parsed.data) }, 201);
  } catch (error) {
    if (isDuplicate(error)) {
      return apiError(409, "CATEGORY_EXISTS", "A category with this name already exists.");
    }
    console.error("Admin category creation failed:", error);
    return apiError(500, "CATEGORY_CREATE_FAILED", "The category could not be created.");
  }
}

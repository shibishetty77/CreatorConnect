import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  AdminCategoryError,
  deleteAdminCategory,
  updateAdminCategory,
} from "@/lib/repositories/admin-categories";
import {
  adminCategoryIdSchema,
  adminCategorySchema,
} from "@/lib/validations/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ categoryId: string }> };
type MysqlError = { code?: unknown };

function duplicate(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    (error as MysqlError).code === "ER_DUP_ENTRY";
}

function categoryError(error: unknown) {
  if (error instanceof AdminCategoryError) {
    return apiError(
      error.code === "NOT_FOUND" ? 404 : 409,
      error.code === "NOT_FOUND" ? "CATEGORY_NOT_FOUND" : "CATEGORY_IN_USE",
      error.message,
    );
  }
  if (duplicate(error)) {
    return apiError(409, "CATEGORY_EXISTS", "A category with this name already exists.");
  }
  console.error("Admin category update failed:", error);
  return apiError(500, "CATEGORY_UPDATE_FAILED", "The category could not be updated.");
}

async function getCategoryId(context: RouteContext) {
  const { categoryId: rawId } = await context.params;
  return adminCategoryIdSchema.safeParse(rawId);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request);
  if (guard) return guard;
  const actor = await requireApiRole("Admin");
  if (actor.error) return actor.error;

  const id = await getCategoryId(context);
  if (!id.success) {
    return apiError(400, "INVALID_CATEGORY_ID", "The category ID is invalid.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const parsed = adminCategorySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "INVALID_CATEGORY", "Enter a category name of 1 to 100 characters.");
  }

  try {
    return apiSuccess({ category: await updateAdminCategory(id.data, parsed.data) });
  } catch (error) {
    return categoryError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request, { requireJson: false });
  if (guard) return guard;
  const actor = await requireApiRole("Admin");
  if (actor.error) return actor.error;

  const id = await getCategoryId(context);
  if (!id.success) {
    return apiError(400, "INVALID_CATEGORY_ID", "The category ID is invalid.");
  }
  try {
    await deleteAdminCategory(id.data);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return categoryError(error);
  }
}

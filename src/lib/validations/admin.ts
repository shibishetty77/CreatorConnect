import { z } from "zod";

export const adminCategoryIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "The ID must be a positive integer.")
  .transform(Number)
  .refine(Number.isSafeInteger, "The ID is invalid.");

export const adminCategorySchema = z
  .object({
    categoryName: z.string().trim().min(1).max(100),
  })
  .strict();

export type AdminCategoryInput = z.infer<typeof adminCategorySchema>;

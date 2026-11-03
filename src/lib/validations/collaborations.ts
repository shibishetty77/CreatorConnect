import { z } from "zod";

export const collaborationIdParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "The collaboration ID must be a positive integer.")
  .transform(Number)
  .refine(Number.isSafeInteger, "The collaboration ID is invalid.");

export const creatorCollaborationQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, "Search text must be at most 120 characters.")
    .optional(),
  status: z.enum(["Active", "Completed", "all"]).default("all"),
  page: z.coerce
    .number()
    .int("Page must be a whole number.")
    .min(1, "Page must be at least 1.")
    .max(10_000, "Page is too large.")
    .default(1),
  pageSize: z.coerce
    .number()
    .int("Page size must be a whole number.")
    .min(1, "Page size must be at least 1.")
    .max(50, "Page size must be at most 50.")
    .default(6),
});

export type CreatorCollaborationQuery = z.infer<
  typeof creatorCollaborationQuerySchema
>;

export const collaborationUpdateSchema = z
  .object({
    status: z.enum(["Active", "Completed"]).optional(),
    startDate: z.iso.date("Enter a valid start date.").optional(),
    endDate: z.iso.date("Enter a valid end date.").optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.startDate !== undefined ||
      value.endDate !== undefined,
    "Provide a status or date to update.",
  )
  .superRefine((value, context) => {
    if (
      value.startDate &&
      value.endDate &&
      value.endDate < value.startDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }
  });

export type CollaborationUpdateInput = z.infer<
  typeof collaborationUpdateSchema
>;

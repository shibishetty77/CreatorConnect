import { z } from "zod";

const dateOnly = z.iso.date("Enter a valid date.");

export const applicationIdParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "The application ID must be a positive integer.")
  .transform(Number)
  .refine(Number.isSafeInteger, "The application ID is invalid.");

export const creatorApplicationQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, "Search text must be at most 120 characters.")
    .optional(),
  status: z.enum(["Pending", "Accepted", "Rejected", "all"]).default("all"),
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
    .default(8),
});

export type CreatorApplicationQuery = z.infer<
  typeof creatorApplicationQuerySchema
>;

export const acceptApplicationSchema = z
  .object({
    agreedAmount: z
      .string()
      .regex(
        /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
        "Enter an amount with at most two decimal places.",
      ),
    startDate: dateOnly,
    endDate: dateOnly,
  })
  .superRefine((value, context) => {
    if (value.endDate < value.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }
  });

export type AcceptApplicationInput = z.infer<
  typeof acceptApplicationSchema
>;

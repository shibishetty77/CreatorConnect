import { z } from "zod";

const dateOnly = z.iso.date("Enter a valid date.");
const decimalAmount = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
    "Enter a non-negative amount with at most two decimal places.",
  );

export const financeIdParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "The ID must be a positive integer.")
  .transform(Number)
  .refine(Number.isSafeInteger, "The ID is invalid.");

export const creatorPaymentQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, "Search text must be at most 120 characters.")
    .optional(),
  status: z.enum(["Pending", "Paid", "all"]).default("all"),
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

export type CreatorPaymentQuery = z.infer<typeof creatorPaymentQuerySchema>;

export const paymentCreateSchema = z
  .object({
    amount: decimalAmount,
    status: z.enum(["Pending", "Paid"]),
    paymentDate: dateOnly.nullable(),
  })
  .strict()
  .superRefine((payment, context) => {
    if (payment.status === "Paid" && !payment.paymentDate) {
      context.addIssue({
        code: "custom",
        path: ["paymentDate"],
        message: "A payment date is required for a paid payment.",
      });
    }
  });

export const paymentUpdateSchema = z
  .object({
    status: z.literal("Paid").optional(),
    paymentDate: dateOnly.nullable().optional(),
  })
  .strict()
  .refine(
    (payment) => payment.status !== undefined || payment.paymentDate !== undefined,
    "Provide a payment status or date to update.",
  )
  .superRefine((payment, context) => {
    if (payment.status === "Paid" && payment.paymentDate === null) {
      context.addIssue({
        code: "custom",
        path: ["paymentDate"],
        message: "A payment date is required when marking a payment paid.",
      });
    }
  });

const metricCount = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, "Enter a non-negative whole number.")
  .refine((value) => {
    const max = "9223372036854775807";
    return value.length < max.length || (value.length === max.length && value <= max);
  }, "The value exceeds the database BIGINT limit.");

export const metricsUpsertSchema = z
  .object({
    views: metricCount,
    likes: metricCount,
    comments: metricCount,
    shares: metricCount,
    clicks: metricCount,
  })
  .strict();

export const reviewUpsertSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    feedback: z.string().trim().max(5000, "Feedback must be 5,000 characters or fewer."),
  })
  .strict();

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
export type MetricsUpsertInput = z.infer<typeof metricsUpsertSchema>;
export type ReviewUpsertInput = z.infer<typeof reviewUpsertSchema>;

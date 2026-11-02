import { z } from "zod";

const dateOnly = z.iso.date("Enter a valid date.");

export const applicationIdParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "The application ID must be a positive integer.")
  .transform(Number)
  .refine(Number.isSafeInteger, "The application ID is invalid.");

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

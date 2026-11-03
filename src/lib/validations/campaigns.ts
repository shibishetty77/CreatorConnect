import { z } from "zod";

import { socialPlatforms } from "@/lib/validations/profiles";

export const campaignIdParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "The campaign ID must be a positive integer.")
  .transform(Number)
  .refine(Number.isSafeInteger, "The campaign ID is invalid.");

function emptyToUndefined(value: unknown): unknown {
  return value === "" || value === null ? undefined : value;
}

const optionalPositiveInteger = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .int("Enter a whole number.")
    .positive("Enter a positive number.")
    .optional(),
);

const optionalNonNegativeNumber = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .min(0, "Enter a non-negative amount.")
    .optional(),
);

export const campaignStatuses = ["Open", "Ongoing", "Completed"] as const;

export const creatorCampaignQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(120, "Search text must be at most 120 characters.")
      .optional(),
    categoryId: optionalPositiveInteger,
    platform: z.enum(socialPlatforms).optional(),
    minBudget: optionalNonNegativeNumber,
    maxBudget: optionalNonNegativeNumber,
    status: z.enum([...campaignStatuses, "all"]).default("Open"),
    sort: z.enum(["newest", "budget_desc", "budget_asc"]).default("newest"),
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
      .max(24, "Page size must be at most 24.")
      .default(6),
  })
  .superRefine((value, context) => {
    if (
      value.minBudget !== undefined &&
      value.maxBudget !== undefined &&
      value.maxBudget < value.minBudget
    ) {
      context.addIssue({
        code: "custom",
        path: ["maxBudget"],
        message: "Maximum budget must be greater than or equal to the minimum.",
      });
    }
  });

export type CreatorCampaignQuery = z.infer<typeof creatorCampaignQuerySchema>;

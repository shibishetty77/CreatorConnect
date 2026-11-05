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

const brandCampaignFields = {
  campaignName: z
    .string()
    .trim()
    .min(3, "Campaign name must be at least 3 characters.")
    .max(150, "Campaign name must be at most 150 characters."),
  description: z
    .string()
    .trim()
    .max(4000, "Description must be at most 4000 characters.")
    .nullable()
    .optional(),
  categoryId: z
    .preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.coerce
        .number()
        .int("Choose a valid category.")
        .positive("Choose a valid category.")
        .nullable(),
    )
    .optional(),
  budget: z.coerce
    .number()
    .positive("Budget must be greater than zero.")
    .max(9_999_999_999.99, "Budget is too large.")
    .transform((value) => value.toFixed(2)),
  minFollowers: z.coerce
    .number()
    .int("Minimum followers must be a whole number.")
    .min(0, "Minimum followers cannot be negative.")
    .default(0),
  creatorLimit: z.coerce
    .number()
    .int("Creator limit must be a whole number.")
    .min(1, "Creator limit must be at least one.")
    .max(100, "Creator limit cannot exceed 100.")
    .default(1),
  startDate: z.iso.date("Enter a valid start date."),
  endDate: z.iso.date("Enter a valid end date."),
};

function validateBrandCampaignDates(
  value: { startDate?: string; endDate?: string },
  context: z.RefinementCtx,
) {
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
}

export const brandCampaignCreateSchema = z
  .object(brandCampaignFields)
  .superRefine(validateBrandCampaignDates);

export const brandCampaignUpdateSchema = z
  .object({
    campaignName: brandCampaignFields.campaignName.optional(),
    description: brandCampaignFields.description,
    categoryId: brandCampaignFields.categoryId,
    budget: brandCampaignFields.budget.optional(),
    minFollowers: brandCampaignFields.minFollowers.optional(),
    creatorLimit: brandCampaignFields.creatorLimit.optional(),
    startDate: brandCampaignFields.startDate.optional(),
    endDate: brandCampaignFields.endDate.optional(),
    status: z.enum(campaignStatuses).optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "Provide at least one campaign field to update.",
  )
  .superRefine(validateBrandCampaignDates);

export type BrandCampaignCreateInput = z.output<
  typeof brandCampaignCreateSchema
>;
export type BrandCampaignUpdateInput = z.output<
  typeof brandCampaignUpdateSchema
>;

import { z } from "zod";

export const collaborationIdParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "The collaboration ID must be a positive integer.")
  .transform(Number)
  .refine(Number.isSafeInteger, "The collaboration ID is invalid.");

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

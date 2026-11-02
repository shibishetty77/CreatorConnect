import { z } from "zod";

const dateOnly = z.iso.date("Enter a valid date.");

export const deliveryIdParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "The ID must be a positive integer.")
  .transform(Number)
  .refine(Number.isSafeInteger, "The ID is invalid.");

export const deliverableCreateSchema = z
  .object({
    contentType: z.enum(["Reel", "Story", "Post", "Video"]),
    dueDate: dateOnly,
  })
  .strict();

export const deliverableUpdateSchema = z
  .object({
    contentType: z.enum(["Reel", "Story", "Post", "Video"]).optional(),
    dueDate: dateOnly.optional(),
  })
  .strict()
  .refine(
    (value) => value.contentType !== undefined || value.dueDate !== undefined,
    "Provide a content type or due date to update.",
  );

const contentUrlSchema = z
  .string()
  .trim()
  .min(1, "Enter a link to the submitted work.")
  .max(500, "The link must be 500 characters or fewer.")
  .url("Enter a valid URL.")
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "The link must use HTTP or HTTPS.");

export const contentSubmissionSchema = z
  .object({ contentUrl: contentUrlSchema })
  .strict();

export const submissionReviewSchema = z
  .object({ approvalStatus: z.enum(["Approved", "Rejected"]) })
  .strict();

export const contractDatesSchema = z
  .object({
    signedDate: dateOnly,
    expiryDate: dateOnly,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.expiryDate < value.signedDate) {
      context.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date must be on or after the signed date.",
      });
    }
  });

export type DeliverableCreateInput = z.infer<typeof deliverableCreateSchema>;
export type DeliverableUpdateInput = z.infer<typeof deliverableUpdateSchema>;
export type ContentSubmissionInput = z.infer<typeof contentSubmissionSchema>;
export type SubmissionReviewInput = z.infer<typeof submissionReviewSchema>;
export type ContractDatesInput = z.infer<typeof contractDatesSchema>;

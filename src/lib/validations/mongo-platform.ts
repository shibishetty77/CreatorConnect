import { z } from "zod";

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(180),
  url: z
    .string()
    .trim()
    .max(2048)
    .url()
    .refine((value) => value.startsWith("https://"), "Attachment URLs must use HTTPS."),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(25_000_000),
});

export const collaborationMessageSchema = z.object({
  message: z.string().trim().max(2000).optional().default(""),
  attachments: z.array(attachmentSchema).max(5).default([]),
}).refine(
  (value) => value.message.length > 0 || value.attachments.length > 0,
  { message: "Add a message or at least one attachment." },
);

export const mongoIdParamSchema = z.string().regex(/^[a-f\d]{24}$/i);

export const activityLimitSchema = z.coerce.number().int().min(1).max(100).default(50);

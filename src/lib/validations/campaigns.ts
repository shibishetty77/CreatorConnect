import { z } from "zod";

export const campaignIdParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "The campaign ID must be a positive integer.")
  .transform(Number)
  .refine(Number.isSafeInteger, "The campaign ID is invalid.");

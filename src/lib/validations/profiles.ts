import { z } from "zod";

function nullIfEmpty(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function optionalText(max: number, message: string) {
  return z.preprocess(
    nullIfEmpty,
    z
      .string()
      .max(max, message)
      .nullable(),
  );
}

function optionalUrl(max: number) {
  return z.preprocess(
    nullIfEmpty,
    z
      .string()
      .max(max, `URL must be at most ${max} characters.`)
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      }, "Enter a valid http:// or https:// URL.")
      .nullable(),
  );
}

const phone = optionalText(15, "Contact number must be at most 15 characters.")
  .refine(
    (value) => value === null || /^[0-9+\-()\s]{7,15}$/.test(value),
    "Enter a valid contact number.",
  );

const dateOfBirth = z.preprocess(
  nullIfEmpty,
  z.iso
    .date("Enter a valid date of birth.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return date.getTime() <= Date.now();
    }, "Date of birth cannot be in the future.")
    .nullable(),
);

export const creatorProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(50, "First name must be at most 50 characters."),
  lastName: z
    .string()
    .trim()
    .max(50, "Last name must be at most 50 characters."),
  dateOfBirth,
  phone,
  bio: optionalText(2000, "Bio must be at most 2000 characters."),
  address: optionalText(255, "Address must be at most 255 characters."),
  city: optionalText(100, "City must be at most 100 characters."),
  state: optionalText(100, "State must be at most 100 characters."),
  profilePictureUrl: optionalUrl(500),
});

export const brandProfileSchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1, "Brand name is required.")
    .max(150, "Brand name must be at most 150 characters."),
  industry: optionalText(100, "Industry must be at most 100 characters."),
  contactNumber: phone,
  address: optionalText(255, "Address must be at most 255 characters."),
  city: optionalText(100, "City must be at most 100 characters."),
  state: optionalText(100, "State must be at most 100 characters."),
});

export const socialPlatforms = [
  "Instagram",
  "YouTube",
  "LinkedIn",
  "Twitter",
  "Facebook",
] as const;

const requiredNumber = (schema: z.ZodType<number>) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    schema,
  );

export const socialAccountSchema = z.object({
  platform: z.enum(socialPlatforms, {
    error: "Choose a supported platform.",
  }),
  username: z
    .string()
    .trim()
    .min(1, "Account username is required.")
    .max(100, "Account username must be at most 100 characters."),
  followers: requiredNumber(
    z.coerce
      .number({ error: "Followers must be a number." })
      .int("Followers must be a whole number.")
      .min(0, "Followers cannot be negative.")
      .max(Number.MAX_SAFE_INTEGER, "Followers value is too large."),
  ),
  engagementRate: requiredNumber(
    z.coerce
      .number({ error: "Engagement rate must be a number." })
      .min(0, "Engagement rate cannot be negative.")
      .max(100, "Engagement rate cannot exceed 100%.")
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
        "Use at most two decimal places.",
      ),
  ),
  accountUrl: optionalUrl(255),
});

export type CreatorProfileInput = z.infer<typeof creatorProfileSchema>;
export type BrandProfileInput = z.infer<typeof brandProfileSchema>;
export type SocialAccountInput = z.infer<typeof socialAccountSchema>;

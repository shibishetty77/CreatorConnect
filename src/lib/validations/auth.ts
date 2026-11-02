import { z, type ZodError } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Password must be at most 72 bytes.",
  )
  .regex(/[A-Za-z]/, "Password must include at least one letter.")
  .regex(/[0-9]/, "Password must include at least one number.");

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(50, "Username must be at most 50 characters.")
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "Username can contain only letters, numbers, dots, underscores, and hyphens.",
  )
  .transform((value) => value.toLowerCase());

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))
  .pipe(z.string().max(100, "Email must be at most 100 characters."));

export const registerSchema = z
  .object({
    username: usernameSchema,
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(150, "Name must be at most 150 characters."),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    role: z.enum(["Creator", "Brand"]),
  })
  .superRefine((data, context) => {
    if (data.password !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }

    if (data.role === "Creator" && !data.name.includes(" ")) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "Enter your first and last name.",
      });
    }
  });

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your email or username.")
    .max(100, "Email or username is too long."),
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(72, "Password is too long."),
  next: z.string().trim().max(300).optional(),
});

export const adminBootstrapSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !(field in fields)) {
      fields[field] = issue.message;
    }
  }

  return fields;
}

import { hashPassword } from "../src/lib/auth/password";
import { bootstrapAdmin } from "../src/lib/auth/users";
import { closePool } from "../src/lib/db";
import { adminBootstrapSchema } from "../src/lib/validations/auth";

async function main(): Promise<void> {
  const parsed = adminBootstrapSchema.safeParse({
    username: process.env.ADMIN_USERNAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      "Set ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD before running this script.\n" +
        messages,
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const result = await bootstrapAdmin({
    username: parsed.data.username,
    email: parsed.data.email,
    passwordHash,
  });

  if (result.status === "created") {
    console.log(`Admin account created (user_id=${result.userId}).`);
  } else {
    console.log(`Admin account already exists (user_id=${result.userId}).`);
    console.log("No password or profile changes were made.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      `Admin bootstrap failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

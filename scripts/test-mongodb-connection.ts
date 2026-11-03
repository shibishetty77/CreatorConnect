import { closeMongoConnection, checkMongoConnection } from "../src/lib/mongodb";

async function main(): Promise<void> {
  try {
    const status = await checkMongoConnection();
    console.info(
      `MongoDB connection successful (${status.database}, ${status.version}).`,
    );
  } catch (error) {
    console.error(
      "MongoDB connection test failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    if (
      error instanceof Error &&
      error.message.startsWith("Missing required environment variable: MONGODB_")
    ) {
      console.error(error.message);
    }
    process.exitCode = 1;
  } finally {
    await closeMongoConnection();
  }
}

void main();

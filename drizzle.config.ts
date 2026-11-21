import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/infrastructure/database/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: databaseUrl,
  },
});

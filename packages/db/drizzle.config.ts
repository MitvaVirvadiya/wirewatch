import { defineConfig } from "drizzle-kit";

/**
 * Migration generation config (ADR-0004).
 *
 * - `schema` points at the schema barrel so every table is picked up.
 * - `out` holds committed, expand-only SQL migrations (never edit an applied file).
 * - Local default URL matches docker-compose.yml credentials; DATABASE_URL wins.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://wirewatch:wirewatch@localhost:5432/wirewatch",
  },
  strict: true,
  verbose: true,
});

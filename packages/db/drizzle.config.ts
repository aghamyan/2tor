import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

/** packages/db -> packages -> repo root, where `.env` lives (see docs/INFRA.md). */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_ENV_PATH = path.join(__dirname, "..", "..", ".env");

try {
  process.loadEnvFile(REPO_ROOT_ENV_PATH);
} catch {
  // No root .env file (e.g. CI provides DATABASE_URL directly via the environment).
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/app",
  },
});

import createNextIntlPlugin from "next-intl/plugin";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.join(__dirname, "..", "..");
const repositoryEnvFile = path.join(repositoryRoot, ".env");

// Next only auto-loads .env files from apps/web, while this monorepo intentionally owns one
// environment file at the repository root. Containers still take precedence through process.env.
if (existsSync(repositoryEnvFile)) {
  process.loadEnvFile(repositoryEnvFile);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Pin explicitly so Next always treats the monorepo root, not apps/web, as the Turbopack root.
  turbopack: {
    root: repositoryRoot,
  },
  transpilePackages: [
    "@app/ui",
    "@app/db",
    "@app/auth",
    "@app/config",
    "@app/i18n",
    "@app/validation",
    "@app/domain",
    "@app/email",
    "@app/observability",
    "@app/notifications",
  ],
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);

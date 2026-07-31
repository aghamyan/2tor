import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const composeFile = path.join(repositoryRoot, "docker-compose.test.yml");

export function pgLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function databaseRows<T>(query: string): T[] {
  const normalized = query.trim().replace(/;$/, "");
  const wrapped =
    `SELECT COALESCE(json_agg(row_to_json(e2e_result)), '[]'::json)::text ` +
    `FROM (${normalized}) AS e2e_result`;
  const output = execFileSync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "db_test",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      process.env.POSTGRES_TEST_USER ?? "postgres",
      "-d",
      process.env.POSTGRES_TEST_DB ?? "app_test",
      "-At",
      "-c",
      wrapped,
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();
  return JSON.parse(output || "[]") as T[];
}

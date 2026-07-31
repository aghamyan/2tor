import { glob, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { locales } from "./config";

type JsonObject = { [key: string]: unknown };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flatten(value: JsonObject, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(child)) for (const nestedKey of flatten(child, path)) keys.add(nestedKey);
    else keys.add(path);
  }
  return keys;
}

async function getKeys(locale: (typeof locales)[number]): Promise<Set<string>> {
  const directory = fileURLToPath(new URL(`../messages/${locale}/`, import.meta.url));
  const files: string[] = [];
  for await (const file of glob("*.json", { cwd: directory })) files.push(String(file));
  const keys = new Set<string>();
  for (const file of files) {
    const value: unknown = JSON.parse(
      await readFile(new URL(file, new URL(`../messages/${locale}/`, import.meta.url)), "utf8"),
    );
    if (!isObject(value)) throw new Error(`messages/${locale}/${file} must contain a JSON object.`);
    for (const key of flatten(value)) keys.add(key);
  }
  return keys;
}

const [englishKeys, armenianKeys] = await Promise.all([getKeys("en"), getKeys("hy")]);
const missing = [...englishKeys].filter((key) => !armenianKeys.has(key)).sort();

if (missing.length > 0) {
  console.error(
    `Missing Armenian translations for ${missing.length} English key(s):\n${missing.map((key) => `  - ${key}`).join("\n")}`,
  );
  process.exitCode = 1;
}

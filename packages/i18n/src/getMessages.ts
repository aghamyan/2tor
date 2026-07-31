import { glob, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AbstractIntlMessages } from "next-intl";
import { isLocale, type Locale } from "./config";

type MessageObject = { [key: string]: string | MessageObject };

/**
 * Bundler-safe alternative to `fileURLToPath(import.meta.url)`. Turbopack's Server
 * Component runtime provides a `URL` global that isn't the same class Node's
 * `node:url` bindings validate with `instanceof`, so `fileURLToPath(new URL(...))`
 * throws `ERR_INVALID_ARG_TYPE` even though the value is structurally a URL.
 * `import.meta.dirname` is also unset in that runtime. Parsing the `file://`
 * string directly avoids constructing a `URL` object at all.
 */
function fileUrlToPath(fileUrl: string): string {
  return decodeURIComponent(fileUrl.replace(/^file:\/\//, ""));
}

async function globJsonFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for await (const file of glob("*.json", { cwd: directory })) files.push(String(file));
  return files.sort();
}

function isMessageObject(value: unknown): value is MessageObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeMessages(
  target: MessageObject,
  source: MessageObject,
  sourceName: string,
): MessageObject {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (isMessageObject(existing) && isMessageObject(value)) {
      mergeMessages(existing, value, sourceName);
    } else if (existing !== undefined) {
      throw new Error(`Duplicate message key "${key}" while loading ${sourceName}.`);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/**
 * Discovers and merges every `messages/<locale>/*.json` module at runtime.
 * Adding a domain module therefore never requires editing a central index.
 */
export async function getMessages(locale: Locale): Promise<AbstractIntlMessages> {
  if (!isLocale(locale)) throw new Error(`Unsupported locale: ${locale}`);

  const currentDirectory = dirname(fileUrlToPath(import.meta.url));
  const messagesDirectory = join(currentDirectory, "../messages", locale);
  const files = await globJsonFiles(messagesDirectory);
  if (files.length === 0) throw new Error(`No message modules found for locale "${locale}".`);

  const messages: MessageObject = {};
  for (const file of files) {
    const contents = await readFile(join(messagesDirectory, file), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      throw new Error(`Invalid JSON in messages/${locale}/${file}.`);
    }
    if (!isMessageObject(parsed))
      throw new Error(`Message module messages/${locale}/${file} must be an object.`);
    mergeMessages(messages, parsed, `messages/${locale}/${file}`);
  }

  return messages as AbstractIntlMessages;
}

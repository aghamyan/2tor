import type { JobSchema } from "../../job";

export function objectSchema<T>(isValid: (value: unknown) => value is T): JobSchema<T> {
  return {
    parse(value) {
      if (!isValid(value)) throw new Error("Invalid notification job payload.");
      return value;
    },
    safeParse(value) {
      return isValid(value)
        ? { success: true, data: value }
        : { success: false, error: new Error("Invalid notification job payload.") };
    },
  };
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

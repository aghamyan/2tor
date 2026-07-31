import type { JobSchema } from "../../job";

/**
 * Builds a minimal `JobSchema` from a type guard, for fixtures that need a real parse/safeParse
 * pair without depending on the `zod` package (not resolvable from `apps/worker` — see job.ts).
 * Does not match `*.job.ts` so the registry glob ignores this file.
 */
export function objectSchema<T>(
  validate: (input: unknown) => input is T,
  message: string,
): JobSchema<T> {
  return {
    parse(input) {
      if (!validate(input)) {
        throw new Error(message);
      }
      return input;
    },
    safeParse(input) {
      return validate(input)
        ? { success: true, data: input }
        : { success: false, error: new Error(message) };
    },
  };
}

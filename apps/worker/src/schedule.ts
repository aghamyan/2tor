import type { Job } from "bullmq";

import { enqueueJob } from "./queue";
import type { DiscoveredJob } from "./registry";

/**
 * Registers every discovered job that declares `options.repeat` (a BullMQ `RepeatOptions`,
 * typically a cron `pattern`) as a repeatable producer — retention deletion, missed-feedback
 * reminders, backup-verification alerts, analytics aggregation, payout report generation, etc.
 * These are ordinary job definitions discovered the same way as on-demand jobs; the only
 * difference is the presence of `options.repeat`.
 *
 * Safe to call on every worker boot: BullMQ upserts a repeatable job by `name` + repeat key
 * (`override: true` under the hood), so re-registering an unchanged schedule is a no-op and a
 * changed `pattern` replaces the old schedule rather than running both.
 */
export async function registerSchedules(discovered: DiscoveredJob[]): Promise<Job[]> {
  const scheduled = discovered.filter((job) => job.definition.options?.repeat !== undefined);

  return Promise.all(
    scheduled.map(({ definition }) => {
      const repeat = definition.options?.repeat;
      if (!repeat) {
        throw new Error(
          `Job "${definition.name}" was filtered as scheduled but has no options.repeat.`,
        );
      }
      const payload = definition.options?.repeatPayload ?? {};
      return enqueueJob(definition, payload, { repeat });
    }),
  );
}

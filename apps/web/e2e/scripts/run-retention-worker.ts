import retentionDeletionJob from "../../../worker/src/jobs/admin/retention-deletion.job";
import type { JobLogger } from "../../../worker/src/job";

const logger: JobLogger = {
  info() {},
  warn() {},
  error() {},
  child() {
    return logger;
  },
};

try {
  await retentionDeletionJob.handler(
    { limit: 50 },
    {
      jobId: "e2e-retention-run",
      queue: retentionDeletionJob.queue,
      name: retentionDeletionJob.name,
      attemptsMade: 1,
      log: logger,
    },
  );
  process.exit(0);
} catch (error: unknown) {
  console.error(error);
  process.exit(1);
}

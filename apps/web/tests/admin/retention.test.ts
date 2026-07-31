import { describe, expect, it } from "vitest";

import {
  LEGAL_RETENTION_ENTITY_TYPES,
  OPTIONAL_CONTENT_ENTITY_TYPES,
  classifyRetention,
  runDeletionJob,
  type DeletionExecutor,
  type DeletionJobInput,
} from "../../../../packages/domain/administration/retention";

class RecordingExecutor implements DeletionExecutor {
  readonly calls: DeletionJobInput[] = [];
  async deleteEntity(input: DeletionJobInput): Promise<void> {
    this.calls.push(input);
  }
}

describe("classifyRetention", () => {
  it("classifies every legal-retention entity type as legal", () => {
    for (const entityType of LEGAL_RETENTION_ENTITY_TYPES) {
      expect(classifyRetention(entityType)).toBe("legal");
    }
  });

  it("classifies every optional-content entity type as optional", () => {
    for (const entityType of OPTIONAL_CONTENT_ENTITY_TYPES) {
      expect(classifyRetention(entityType)).toBe("optional");
    }
  });

  it("classifies an unrecognized entity type as unknown, not optional", () => {
    expect(classifyRetention("some_future_table")).toBe("unknown");
  });
});

describe("runDeletionJob — preserves legal records, removes optional content", () => {
  it("blocks a legal-retention record and never calls the executor", async () => {
    const executor = new RecordingExecutor();
    const outcome = await runDeletionJob(
      { targetEntityType: "consent_records", targetEntityId: "consent-1", scope: "full_erase" },
      executor,
    );
    expect(outcome.status).toBe("blocked");
    expect(outcome).toMatchObject({
      blockReason: expect.stringContaining("legal_retention_required"),
    });
    expect(executor.calls).toHaveLength(0);
  });

  it("blocks every legal-retention entity type, individually, with no executor call", async () => {
    for (const entityType of LEGAL_RETENTION_ENTITY_TYPES) {
      const executor = new RecordingExecutor();
      const outcome = await runDeletionJob(
        { targetEntityType: entityType, targetEntityId: "x", scope: "full_erase" },
        executor,
      );
      expect(outcome.status).toBe("blocked");
      expect(executor.calls).toHaveLength(0);
    }
  });

  it("deletes an optional-content record via the executor and reports completion", async () => {
    const executor = new RecordingExecutor();
    const now = new Date("2026-07-29T12:00:00.000Z");
    const outcome = await runDeletionJob(
      { targetEntityType: "bookmarks", targetEntityId: "bookmark-1", scope: "full_erase" },
      executor,
      now,
    );
    expect(outcome).toEqual({ status: "completed", completedAt: now });
    expect(executor.calls).toEqual([
      { targetEntityType: "bookmarks", targetEntityId: "bookmark-1", scope: "full_erase" },
    ]);
  });

  it("blocks an unclassified entity type rather than guessing it's safe to delete", async () => {
    const executor = new RecordingExecutor();
    const outcome = await runDeletionJob(
      { targetEntityType: "some_future_table", targetEntityId: "x", scope: "full_erase" },
      executor,
    );
    expect(outcome.status).toBe("blocked");
    expect(outcome).toMatchObject({
      blockReason: expect.stringContaining("unclassified_entity_type"),
    });
    expect(executor.calls).toHaveLength(0);
  });

  it("in one batch, blocks legal records and deletes optional ones without cross-contamination", async () => {
    const executor = new RecordingExecutor();
    const jobs: DeletionJobInput[] = [
      { targetEntityType: "consent_records", targetEntityId: "c1", scope: "full_erase" },
      { targetEntityType: "bookmarks", targetEntityId: "b1", scope: "full_erase" },
      { targetEntityType: "payment_transactions", targetEntityId: "p1", scope: "full_erase" },
      { targetEntityType: "messages", targetEntityId: "m1", scope: "anonymize" },
    ];
    const outcomes = await Promise.all(jobs.map((job) => runDeletionJob(job, executor)));
    expect(outcomes.map((o) => o.status)).toEqual(["blocked", "completed", "blocked", "completed"]);
    expect(executor.calls.map((c) => c.targetEntityId).sort()).toEqual(["b1", "m1"]);
  });
});

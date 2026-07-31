import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, expectJson, test } from "./fixtures/actors";
import { databaseRows, pgLiteral, repositoryRoot } from "./helpers/database";

interface Envelope<T> {
  data: T;
  requestId: string;
}

test.describe.serial("data export and deletion controls", () => {
  test("data export needs a different administrator", async ({ actors }) => {
    const requestResponse = await actors.admin.post("/api/admin/exports", {
      data: {
        type: "family-data",
        filters: { parentProfileId: "pprof_demo_1" },
        reason: "Parent requested a portable copy of family data.",
      },
    });
    const requested = await expectJson<
      Envelope<{
        export: { id: string; status: string; requestedByUserId: string };
        approvalRequestId: string;
      }>
    >(requestResponse, 201);
    expect(requested.data.export).toMatchObject({
      status: "pending",
      requestedByUserId: "usr_demo_admin",
    });

    const selfApprovalResponse = await actors.admin.post(
      `/api/admin/exports/${requested.data.export.id}/decide`,
      {
        data: {
          approvalRequestId: requested.data.approvalRequestId,
          decision: "approved",
          reason: "Attempted self-approval must be blocked.",
        },
      },
    );
    const selfApproval = await expectJson<{ error: { code: string } }>(selfApprovalResponse, 403);
    expect(selfApproval.error.code).toBe("SELF_APPROVAL_FORBIDDEN");

    const approvalResponse = await actors.approver.post(
      `/api/admin/exports/${requested.data.export.id}/decide`,
      {
        data: {
          approvalRequestId: requested.data.approvalRequestId,
          decision: "approved",
          reason: "Scope and parent identity were independently reviewed.",
        },
      },
    );
    const approved = await expectJson<
      Envelope<{ id: string; status: string; approvedByUserId: string }>
    >(approvalResponse, 200);
    expect(approved.data).toMatchObject({
      id: requested.data.export.id,
      status: "processing",
      approvedByUserId: "usr_e2e_approver",
    });
  });

  test("deletion erases optional education data but preserves legal payment data", async ({
    actors,
  }) => {
    const optionalResponse = await actors.admin.post("/api/admin/deletions", {
      data: {
        targetEntityType: "student_interests",
        targetEntityId: "interest_e2e_optional",
        scope: "full_erase",
        reason: "Parent requested removal of optional educational profile content.",
        privacyRequestId: null,
        scheduledFor: null,
      },
    });
    const optional = await expectJson<
      Envelope<{ job: { id: string; status: string }; approvalRequestId: string }>
    >(optionalResponse, 201);
    expect(optional.data.job.status).toBe("blocked");

    const legalResponse = await actors.admin.post("/api/admin/deletions", {
      data: {
        targetEntityType: "payment_transactions",
        targetEntityId: "ptxn_e2e_authorization",
        scope: "full_erase",
        reason: "Deletion request must be separated from legally retained payment records.",
        privacyRequestId: null,
        scheduledFor: null,
      },
    });
    const legal = await expectJson<
      Envelope<{ job: { id: string; status: string }; approvalRequestId: string }>
    >(legalResponse, 201);
    expect(legal.data.job.status).toBe("blocked");

    execFileSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "apps/web/e2e/scripts/run-deletion-approval.ts",
        optional.data.job.id,
        optional.data.approvalRequestId,
        legal.data.job.id,
        legal.data.approvalRequestId,
      ],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          DATABASE_URL:
            process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/app_test",
          REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6389",
          TSX_TSCONFIG_PATH: path.join(repositoryRoot, "tsconfig.base.json"),
        },
        stdio: "inherit",
      },
    );

    expect(
      databaseRows<{ id: string }>(
        `SELECT id FROM deletion_jobs WHERE id IN (` +
          `${pgLiteral(optional.data.job.id)}, ${pgLiteral(legal.data.job.id)}) ` +
          `AND status = 'scheduled' ORDER BY id`,
      ),
    ).toHaveLength(2);

    execFileSync("pnpm", ["exec", "tsx", "apps/web/e2e/scripts/run-retention-worker.ts"], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/app_test",
        TSX_TSCONFIG_PATH: path.join(repositoryRoot, "tsconfig.base.json"),
      },
      stdio: "inherit",
    });

    expect(
      databaseRows<{ id: string }>(
        "SELECT id FROM student_interests WHERE id = 'interest_e2e_optional'",
      ),
    ).toEqual([]);
    expect(
      databaseRows<{ id: string }>(
        "SELECT id FROM payment_transactions WHERE id = 'ptxn_e2e_authorization'",
      ),
    ).toEqual([{ id: "ptxn_e2e_authorization" }]);

    const [optionalJob] = databaseRows<{
      status: string;
      block_reason: string | null;
      completed_at: string | null;
    }>(
      `SELECT status, block_reason, completed_at FROM deletion_jobs ` +
        `WHERE id = ${pgLiteral(optional.data.job.id)}`,
    );
    expect(optionalJob?.status).toBe("completed");
    expect(optionalJob?.block_reason).toBeNull();
    expect(optionalJob?.completed_at).not.toBeNull();

    const [legalJob] = databaseRows<{ status: string; block_reason: string | null }>(
      `SELECT status, block_reason FROM deletion_jobs ` +
        `WHERE id = ${pgLiteral(legal.data.job.id)}`,
    );
    expect(legalJob).toEqual({
      status: "blocked",
      block_reason: "legal_retention_required:payment_transactions",
    });

    const workerAudits = databaseRows<{ resource_id: string; action: string }>(
      `SELECT resource_id, action FROM audit_events WHERE resource_id IN (` +
        `${pgLiteral(optional.data.job.id)}, ${pgLiteral(legal.data.job.id)}) ` +
        `AND action IN ('deletion_job.completed', 'deletion_job.blocked') ` +
        `ORDER BY action`,
    );
    expect(workerAudits).toEqual([
      { resource_id: legal.data.job.id, action: "deletion_job.blocked" },
      { resource_id: optional.data.job.id, action: "deletion_job.completed" },
    ]);
  });
});

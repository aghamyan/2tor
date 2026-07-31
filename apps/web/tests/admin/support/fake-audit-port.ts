import type {
  ApprovalDecisionResult,
  ApproveHighRiskActionValues,
  AuditPort,
  PendingApprovalSummary,
  RecordAdminAccessValues,
  RecordAuditValues,
  RequestApprovalValues,
} from "../../../../../packages/domain/administration/models";

/**
 * Configurable `AuditPort` fake for administration service tests. Deliberately does **not**
 * re-implement `@app/audit`'s real self-approval logic — that guarantee is proven against the
 * real implementation in `packages/audit/src/approval.test.ts`. This fake exists so
 * `services.ts`'s own defense-in-depth checks (e.g. `decideBulkExport`'s
 * `exportRecord.requestedByUserId === actor.userId` check against the schema-native column) can
 * be tested in isolation, including asserting `approveHighRiskAction` is never even *called* when
 * that earlier check should have already rejected the request.
 */
export class FakeAuditPort implements AuditPort {
  readonly recordedEvents: RecordAuditValues[] = [];
  readonly accessReasons: RecordAdminAccessValues[] = [];
  readonly approveCalls: ApproveHighRiskActionValues[] = [];
  approveHighRiskActionResult:
    ApprovalDecisionResult | ((values: ApproveHighRiskActionValues) => ApprovalDecisionResult) = {
    decision: "approved",
    requestedByUserId: "someone-else",
    approvedByUserId: "approver",
    action: "bulk_export",
    targetResourceType: "exports",
    targetResourceId: "export-1",
    payload: null,
    decidedAt: new Date("2026-07-29T12:00:00.000Z"),
  };
  pendingApproval: PendingApprovalSummary | null = null;

  async recordAudit(values: RecordAuditValues): Promise<void> {
    this.recordedEvents.push(values);
  }

  async recordAdminAccessReason(values: RecordAdminAccessValues): Promise<void> {
    this.accessReasons.push(values);
  }

  async requestApproval(_values: RequestApprovalValues) {
    return {
      approvalRequestId: `approval-${this.recordedEvents.length + 1}`,
      requestedAt: new Date("2026-07-29T12:00:00.000Z"),
    };
  }

  async approveHighRiskAction(
    values: ApproveHighRiskActionValues,
  ): Promise<ApprovalDecisionResult> {
    this.approveCalls.push(values);
    return typeof this.approveHighRiskActionResult === "function"
      ? this.approveHighRiskActionResult(values)
      : this.approveHighRiskActionResult;
  }

  async findPendingApproval(): Promise<PendingApprovalSummary | null> {
    return this.pendingApproval;
  }

  async listPendingApprovals(): Promise<PendingApprovalSummary[]> {
    return this.pendingApproval ? [this.pendingApproval] : [];
  }

  async queryEvents() {
    return { items: [], nextCursor: null };
  }
}

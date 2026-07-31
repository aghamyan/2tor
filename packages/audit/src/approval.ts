import { ulid } from "ulid";

import { AuditError } from "./errors";
import {
  approveHighRiskActionInputSchema,
  requestApprovalInputSchema,
  type ApproveHighRiskActionInput,
  type ApprovalDecisionValue,
  type HighRiskAction,
  type RequestApprovalInput,
} from "./schemas";
import type { AuditStore } from "./types";

export { HIGH_RISK_ACTIONS } from "./schemas";
export type { ApprovalDecisionValue, HighRiskAction } from "./schemas";

/**
 * Two-person high-risk approval, built entirely on `audit_events` — no dedicated approval table.
 * spec §16.4 requires bulk export, role elevation, audit access, mass deletion, large refund,
 * payment-config change, and disabling security controls to need step-up MFA AND a *second*
 * person's approval; "a super-admin cannot solely approve their own high-risk action."
 *
 * `authorize()` (`@app/auth`) does **not** enforce this by itself: its `cannot_self_approve` rule
 * only blocks acting on a resource whose *target* is the actor themselves (e.g. approving your
 * own user account). It has no notion of "someone else already requested this" — that identity
 * check is this module's job, and it is enforced here, not left to the caller to remember.
 *
 * Flow: `requestApproval` (actor A) writes one `audit_events` row (`action: "approval.requested"`,
 * `resourceType: "approval_request"`) whose id becomes the `approvalRequestId`. `approveHighRiskAction`
 * (actor B) writes a second row (`action: "approval.decided"`) referencing it. Both rows are
 * ordinary, immutable audit events — approving/rejecting is recorded, never edited in place.
 *
 * The caller is still responsible for: (1) calling `@app/auth`'s `authorize()` so only a role
 * permitted to decide this action type can call `approveHighRiskAction` at all, (2) checking
 * step-up MFA freshness (`isMfaFreshEnough`) before either step, and (3) actually performing the
 * mutation this approval gates — `approveHighRiskAction` only records the decision; on
 * `decision: "approved"` the caller reads `targetResourceType`/`targetResourceId`/`payload` back
 * off the returned `ApprovalDecision` and applies it.
 */

const APPROVAL_REQUEST_ACTION = "approval.requested";
const APPROVAL_DECIDED_ACTION = "approval.decided";
const APPROVAL_RESOURCE_TYPE = "approval_request";

interface ApprovalRequestPayload {
  action: HighRiskAction;
  targetResourceType: string;
  targetResourceId: string;
  payload: unknown;
}

function isApprovalRequestPayload(value: unknown): value is ApprovalRequestPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<ApprovalRequestPayload>).action === "string" &&
    typeof (value as Partial<ApprovalRequestPayload>).targetResourceType === "string" &&
    typeof (value as Partial<ApprovalRequestPayload>).targetResourceId === "string"
  );
}

export interface ApprovalRequestRecord {
  approvalRequestId: string;
  actorUserId: string;
  action: HighRiskAction;
  targetResourceType: string;
  targetResourceId: string;
  payload: unknown;
  reason: string;
  requestedAt: Date;
}

/** Actor A asks for a high-risk action to be carried out. Performs no mutation of its own. */
export async function requestApproval(
  store: AuditStore,
  input: RequestApprovalInput,
): Promise<ApprovalRequestRecord> {
  const values = requestApprovalInputSchema.parse(input);
  const event = await store.insertEvent({
    id: ulid(),
    actorUserId: values.actorUserId,
    action: APPROVAL_REQUEST_ACTION,
    resourceType: APPROVAL_RESOURCE_TYPE,
    resourceId: values.resourceId,
    reason: values.reason,
    newValue: {
      action: values.action,
      targetResourceType: values.resourceType,
      targetResourceId: values.resourceId,
      payload: values.payload ?? null,
    } satisfies ApprovalRequestPayload,
  });

  return {
    approvalRequestId: event.id,
    actorUserId: values.actorUserId,
    action: values.action,
    targetResourceType: values.resourceType,
    targetResourceId: values.resourceId,
    payload: values.payload ?? null,
    reason: values.reason,
    requestedAt: event.createdAt,
  };
}

export interface ApprovalDecisionRecord {
  approvalRequestId: string;
  decision: ApprovalDecisionValue;
  requestedByUserId: string;
  approvedByUserId: string;
  action: HighRiskAction;
  targetResourceType: string;
  targetResourceId: string;
  payload: unknown;
  decidedAt: Date;
}

/**
 * Actor B decides. Throws `SELF_APPROVAL_FORBIDDEN` (the acceptance-criterion guarantee) when
 * `approverUserId` equals the original requester, regardless of role — there is no role or flag
 * that can bypass this check. Throws `APPROVAL_ALREADY_RESOLVED` on a second decision for the
 * same request, so two different second-approvers can't both "win."
 */
export async function approveHighRiskAction(
  store: AuditStore,
  input: ApproveHighRiskActionInput,
): Promise<ApprovalDecisionRecord> {
  const values = approveHighRiskActionInputSchema.parse(input);

  return store.transaction(async (transaction) => {
    const request = await transaction.findEventById(values.approvalRequestId);
    if (!request || request.action !== APPROVAL_REQUEST_ACTION || request.actorUserId === null) {
      throw new AuditError("APPROVAL_NOT_FOUND", "No pending approval request with that id.", 404);
    }
    if (!isApprovalRequestPayload(request.newValue)) {
      throw new AuditError("APPROVAL_NOT_FOUND", "The approval request is malformed.", 404);
    }

    // The core guarantee: the requester and the approver must be different people, unconditionally.
    if (request.actorUserId === values.approverUserId) {
      throw new AuditError(
        "SELF_APPROVAL_FORBIDDEN",
        "The requester cannot approve their own high-risk action.",
        403,
      );
    }

    const alreadyDecided = await transaction.findDecisionForRequest(values.approvalRequestId);
    if (alreadyDecided) {
      throw new AuditError(
        "APPROVAL_ALREADY_RESOLVED",
        "This approval request has already been decided.",
        409,
      );
    }

    const decisionEvent = await transaction.insertEvent({
      id: ulid(),
      actorUserId: values.approverUserId,
      action: APPROVAL_DECIDED_ACTION,
      resourceType: APPROVAL_RESOURCE_TYPE,
      resourceId: values.approvalRequestId,
      reason: values.reason,
      previousValue: { requestedByUserId: request.actorUserId },
      newValue: { approvalRequestId: values.approvalRequestId, decision: values.decision },
    });

    return {
      approvalRequestId: values.approvalRequestId,
      decision: values.decision,
      requestedByUserId: request.actorUserId,
      approvedByUserId: values.approverUserId,
      action: request.newValue.action,
      targetResourceType: request.newValue.targetResourceType,
      targetResourceId: request.newValue.targetResourceId,
      payload: request.newValue.payload,
      decidedAt: decisionEvent.createdAt,
    };
  });
}

import { decideMassDeletion } from "../../../../packages/domain/administration/services";
import { administrationRequestContext } from "../../../../packages/domain/administration/runtime";

interface ApprovalPair {
  deletionJobId: string;
  approvalRequestId: string;
}

function approvalPairs(args: string[]): ApprovalPair[] {
  if (args.length === 0 || args.length % 2 !== 0) {
    throw new Error("Pass deletion-job and approval-request IDs in pairs.");
  }
  const pairs: ApprovalPair[] = [];
  for (let index = 0; index < args.length; index += 2) {
    const deletionJobId = args[index];
    const approvalRequestId = args[index + 1];
    if (!deletionJobId || !approvalRequestId) {
      throw new Error("Pass deletion-job and approval-request IDs in pairs.");
    }
    pairs.push({
      deletionJobId,
      approvalRequestId,
    });
  }
  return pairs;
}

async function contextAfterRedisConnect() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await administrationRequestContext("e2e-approver");
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw lastError;
}

const context = await contextAfterRedisConnect();
for (const pair of approvalPairs(process.argv.slice(2))) {
  await decideMassDeletion(context.database, context.audit, context.actor, {
    ...pair,
    decision: "approved",
    reason: "Independent privacy approver verified the requested deletion scope.",
  });
}

process.exit(0);

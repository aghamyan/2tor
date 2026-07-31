import { generateReportingSnapshot } from "./aggregate";
import { ReportingError } from "./errors";
import { reportKey } from "./periods";
import type {
  FunnelEventFact,
  ReportPeriod,
  ReportingActor,
  ReportingCadence,
  ReportingRepository,
  ReportingSnapshot,
} from "./models";

export function requireReportingAccess(
  actor: ReportingActor | null | undefined,
): asserts actor is ReportingActor {
  if (!actor) throw new ReportingError("UNAUTHENTICATED", "A signed-in actor is required.", 401);
  if (!actor.roles.includes("administrator") && !actor.roles.includes("super_administrator")) {
    throw new ReportingError(
      "FORBIDDEN",
      "Aggregate reporting is restricted to authorized administrators.",
      403,
    );
  }
}

export async function buildReportingSnapshot(
  repository: ReportingRepository,
  cadence: ReportingCadence,
  period: ReportPeriod,
  generatedAt = new Date(),
): Promise<ReportingSnapshot> {
  const facts = await repository.loadFacts(period);
  return generateReportingSnapshot(facts, { cadence, period, generatedAt });
}

export async function generateAndStoreReportingSnapshot(
  repository: ReportingRepository,
  cadence: ReportingCadence,
  period: ReportPeriod,
  generatedAt = new Date(),
): Promise<ReportingSnapshot> {
  const key = reportKey(cadence, period);
  const existing = await repository.getStoredReport(key);
  if (existing) return existing;
  const snapshot = await buildReportingSnapshot(repository, cadence, period, generatedAt);
  await repository.saveReport(key, snapshot);
  return snapshot;
}

export async function recordPrivacySafeFunnelEvent(
  repository: ReportingRepository,
  actor: ReportingActor | null | undefined,
  event: FunnelEventFact,
): Promise<void> {
  requireReportingAccess(actor);
  await repository.recordFunnelEvent(event);
}

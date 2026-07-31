import { redirect } from "next/navigation";

import { ConsentError } from "../../../../../packages/domain/consent/errors";
import type { ConsentRecord } from "../../../../../packages/domain/consent/models";
import { hasValidConsent } from "../../../../../packages/domain/consent/services";
import { FamilyError } from "../../../../../packages/domain/families/errors";
import type {
  StudentFamilySummary,
  StudentStatus,
} from "../../../../../packages/domain/families/models";
import {
  getFamilyStudent,
  listFamilyStudents,
} from "../../../../../packages/domain/families/services";
import { authorizeConsentAction, authorizeConsentWorkspace } from "./authorization";
import { currentConsentContext } from "./context";

export interface ConsentOverviewItem extends StudentFamilySummary {
  hasValidConsent: boolean;
}

export interface ConsentStudentDetail {
  studentProfileId: string;
  preferredName: string;
  isAdultLearner: boolean;
  status: StudentStatus;
  hasValidConsent: boolean;
  latestConsent: ConsentRecord | null;
}

function redirectIfUnauthenticated(error: unknown): never {
  if (error instanceof FamilyError && error.code === "UNAUTHENTICATED") redirect("/login");
  if (error instanceof ConsentError && error.code === "UNAUTHENTICATED") redirect("/login");
  throw error;
}

export async function loadConsentOverview(): Promise<{ items: ConsentOverviewItem[] }> {
  try {
    const context = await currentConsentContext();
    authorizeConsentWorkspace(context.actor);
    const page = await listFamilyStudents(context.familyDatabase, context.actor, { limit: 50 });
    const items = await Promise.all(
      page.items.map(async (student) => ({
        ...student,
        hasValidConsent: await hasValidConsent(context.database, student.id),
      })),
    );
    return { items };
  } catch (error: unknown) {
    return redirectIfUnauthenticated(error);
  }
}

export async function loadConsentStudent(studentProfileId: string): Promise<ConsentStudentDetail> {
  try {
    const context = await currentConsentContext();
    await authorizeConsentAction(context.familyDatabase, context.actor, studentProfileId);
    const student = await getFamilyStudent(context.familyDatabase, context.actor, studentProfileId);
    const [valid, records] = await Promise.all([
      hasValidConsent(context.database, studentProfileId),
      context.database.listConsentRecords(studentProfileId),
    ]);
    return {
      studentProfileId,
      preferredName: student.preferredName,
      isAdultLearner: student.isAdultLearner,
      status: student.status,
      hasValidConsent: valid,
      latestConsent: records[0] ?? null,
    };
  } catch (error: unknown) {
    return redirectIfUnauthenticated(error);
  }
}

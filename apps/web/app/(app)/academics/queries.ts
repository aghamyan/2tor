import { redirect } from "next/navigation";

import { AcademicError } from "../../../../../packages/domain/academics/errors";
import type { SkillAssessmentEventRecord, SubjectRecord } from "../../../../../packages/domain/academics/models";
import type { StudentMasteryMap } from "../../../../../packages/domain/academics/services";
import {
  getRecentSkillActivity,
  getStudentMasteryMap,
  listSubjects,
} from "../../../../../packages/domain/academics/services";
import { familyRequestContext } from "../../../../../packages/domain/families/runtime";
import { listFamilyStudents } from "../../../../../packages/domain/families/services";
import { GamificationError } from "../../../../../packages/domain/gamification/errors";
import type { GamificationSummary } from "../../../../../packages/domain/gamification/models";
import { gamificationRequestContext } from "../../../../../packages/domain/gamification/runtime";
import { getGamificationSummary } from "../../../../../packages/domain/gamification/services";
import { currentSession } from "../../../lib/current-session";
import { currentAcademicContext } from "./context";
import { loadSchedulableOptions } from "../scheduling/queries";

function redirectIfUnauthenticated(error: unknown): never {
  if (error instanceof AcademicError && error.code === "UNAUTHENTICATED") redirect("/login");
  throw error;
}

/** One selectable learner in the "Learner" picker — a distinct student, independent of subject. */
export interface LearnerOption {
  studentProfileId: string;
  name: string;
}

/** Role-aware source for the "Learner" picker: a tutor's assigned students, a parent's linked
 * children, or the student themself. Admin has no selector yet — out of scope for this pass. */
export async function loadLearnerOptions(): Promise<LearnerOption[]> {
  const session = await currentSession();
  if (!session) return [];

  if (session.roles.includes("tutor")) {
    const { assignments } = await loadSchedulableOptions();
    const seen = new Map<string, LearnerOption>();
    for (const assignment of assignments)
      seen.set(assignment.studentProfileId, {
        studentProfileId: assignment.studentProfileId,
        name: assignment.studentName,
      });
    return [...seen.values()];
  }

  if (session.roles.includes("parent")) {
    const familyContext = await familyRequestContext(session.id);
    const page = await listFamilyStudents(familyContext.database, familyContext.actor);
    return page.items.map((student) => ({
      studentProfileId: student.id,
      name: student.preferredName,
    }));
  }

  if (session.roles.includes("student")) {
    const gamificationContext = await gamificationRequestContext(session.id);
    const studentProfileId = gamificationContext.actor.studentProfileId;
    return studentProfileId ? [{ studentProfileId, name: "You" }] : [];
  }

  return [];
}

/** Every role's "Subject" picker — reference data, not scoped to who may schedule a lesson. */
export async function loadSubjectOptions(): Promise<SubjectRecord[]> {
  try {
    const context = await currentAcademicContext();
    return await listSubjects(context.database, context.actor);
  } catch (error: unknown) {
    if (error instanceof AcademicError && error.code === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

export async function loadStudentMasteryMap(
  studentProfileId: string,
  subjectId: string,
): Promise<StudentMasteryMap> {
  try {
    const context = await currentAcademicContext();
    return await getStudentMasteryMap(context.database, context.actor, studentProfileId, subjectId);
  } catch (error: unknown) {
    if (error instanceof AcademicError && error.code === "FORBIDDEN")
      return { course: null, domains: [], unsorted: [] };
    return redirectIfUnauthenticated(error);
  }
}

export async function loadRecentSkillActivity(
  studentProfileId: string,
  subjectId: string,
): Promise<SkillAssessmentEventRecord[]> {
  try {
    const context = await currentAcademicContext();
    return await getRecentSkillActivity(context.database, context.actor, studentProfileId, subjectId);
  } catch (error: unknown) {
    if (error instanceof AcademicError && (error.code === "FORBIDDEN" || error.code === "UNAUTHENTICATED"))
      return [];
    throw error;
  }
}

/** Feeds the combined page's "Rewards" section — real points/badges/streaks, not the mastery map. */
export async function loadRewardsSummary(
  studentProfileId: string,
): Promise<GamificationSummary | null> {
  const session = await currentSession();
  if (!session) redirect("/login");
  try {
    const context = await gamificationRequestContext(session.id);
    return await getGamificationSummary(context.database, context.actor, studentProfileId);
  } catch (error: unknown) {
    if (error instanceof GamificationError && error.code === "FORBIDDEN") return null;
    if (error instanceof GamificationError && error.code === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
}

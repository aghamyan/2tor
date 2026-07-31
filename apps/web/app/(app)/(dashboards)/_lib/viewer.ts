import { SESSION_COOKIE_NAME, type Actor } from "@app/auth";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  GamificationError,
  gamificationRequestContext,
} from "../../../../../../packages/domain/gamification/index";
import {
  FamilyError,
  familyRequestContext,
  type StudentProfileRecord,
} from "../../../../../../packages/domain/families/index";
import { authorizedPanelsForActor, preferredDashboardPath } from "./authorization";
import type { DashboardKind, DashboardPanel } from "./catalog";
import { studentExperienceFor, type StudentExperience } from "./student-experience";

async function sessionId(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}

function unauthenticated(error: unknown): boolean {
  return (
    (error instanceof GamificationError && error.code === "UNAUTHENTICATED") ||
    (error instanceof FamilyError && error.code === "UNAUTHENTICATED")
  );
}

export async function currentDashboardActor(): Promise<Actor> {
  try {
    const context = await gamificationRequestContext(await sessionId());
    return context.actor;
  } catch (error: unknown) {
    if (unauthenticated(error)) redirect("/login");
    throw error;
  }
}

export interface DashboardViewer {
  actor: Actor;
  panels: DashboardPanel[];
}

export async function loadDashboardViewer(kind: DashboardKind): Promise<DashboardViewer> {
  const actor = await currentDashboardActor();
  const panels = authorizedPanelsForActor(actor, kind);
  if (panels.length === 0) notFound();
  return { actor, panels };
}

export async function dashboardRedirectPath(): Promise<string> {
  const path = preferredDashboardPath(await currentDashboardActor());
  if (!path) notFound();
  return path;
}

export interface StudentDashboardViewer extends DashboardViewer {
  profile: StudentProfileRecord;
  experience: StudentExperience;
}

export async function loadStudentDashboardViewer(): Promise<StudentDashboardViewer> {
  const id = await sessionId();
  try {
    // Both are public module composition roots. Gamification resolves the student's own profile
    // ID; family provides the privacy-minimized age fields used to select the presentation.
    const [gamificationContext, familyContext] = await Promise.all([
      gamificationRequestContext(id),
      familyRequestContext(id),
    ]);
    if (gamificationContext.actor.userId !== familyContext.actor.userId) notFound();
    const studentProfileId = gamificationContext.actor.studentProfileId;
    if (!studentProfileId) notFound();
    const profile = await familyContext.database.findStudentById(studentProfileId);
    if (!profile || profile.userId !== gamificationContext.actor.userId) notFound();
    const experience = studentExperienceFor(profile);
    const kind = experience === "younger" ? "student-younger" : "student-older";
    const panels = authorizedPanelsForActor(gamificationContext.actor, kind);
    if (panels.length === 0) notFound();
    return { actor: gamificationContext.actor, profile, experience, panels };
  } catch (error: unknown) {
    if (unauthenticated(error)) redirect("/login");
    throw error;
  }
}

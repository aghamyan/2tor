import { SESSION_COOKIE_NAME } from "@app/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ContentError } from "../../../../../packages/domain/content/errors";
import type {
  ResourceRecord,
  ResourceSubjectOption,
} from "../../../../../packages/domain/content/models";
import { contentRequestContext } from "../../../../../packages/domain/content/runtime";
import {
  listBookmarkedResourceIds,
  listResources,
  listResourceSubjects,
} from "../../../../../packages/domain/content/services";

function redirectIfUnauthenticated(error: unknown): never {
  if (error instanceof ContentError && error.code === "UNAUTHENTICATED") redirect("/login");
  throw error;
}

async function currentContentContext() {
  const cookieStore = await cookies();
  return contentRequestContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export interface ContentPageData {
  resources: ResourceRecord[];
  subjects: ResourceSubjectOption[];
  isStudent: boolean;
  bookmarkedResourceIds: string[];
  /** Tutors and staff can author resources; everyone else only ever browses published ones. */
  canCreate: boolean;
}

export async function loadContentPageData(): Promise<ContentPageData> {
  try {
    const context = await currentContentContext();
    const isStudent = context.actor.roles.includes("student");
    const isStaff =
      context.actor.roles.includes("administrator") ||
      context.actor.roles.includes("super_administrator");
    const canCreate = isStaff || context.actor.roles.includes("tutor");
    const [resources, subjects, bookmarkedResourceIds] = await Promise.all([
      listResources(context.database, context.actor),
      listResourceSubjects(context.database, context.actor),
      listBookmarkedResourceIds(context.database, context.actor),
    ]);
    return { resources, subjects, isStudent, bookmarkedResourceIds, canCreate };
  } catch (error) {
    return redirectIfUnauthenticated(error);
  }
}

export interface NewResourceFormData {
  subjects: ResourceSubjectOption[];
}

export async function loadNewResourceFormData(): Promise<NewResourceFormData> {
  try {
    const context = await currentContentContext();
    const isAuthor =
      context.actor.roles.includes("tutor") ||
      context.actor.roles.includes("administrator") ||
      context.actor.roles.includes("super_administrator");
    if (!isAuthor) redirect("/content");
    const subjects = await listResourceSubjects(context.database, context.actor);
    return { subjects };
  } catch (error) {
    return redirectIfUnauthenticated(error);
  }
}

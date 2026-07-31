"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { FamilyError } from "../../../../../packages/domain/families/errors";
import {
  createStudentInputSchema,
  interestsInputSchema,
  linkStudentInputSchema,
  parentProfileInputSchema,
  preferencesInputSchema,
  studentProfileInputSchema,
  unlinkStudentInputSchema,
} from "../../../../../packages/domain/families/schemas";
import {
  correctStudentInfo,
  createParentProfile,
  createStudentUnderParent,
  linkStudent,
  replaceStudentInterests,
  unlinkStudent,
  updateParentProfile,
  updateStudentPreferences,
} from "../../../../../packages/domain/families/services";
import type { FamilyActionState } from "./action-state";
import { authorizeParentWorkspace, authorizeStudentRelationship } from "./authorization";
import { currentFamilyContext } from "./context";

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function errorState(error: unknown): FamilyActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: "errors.invalid",
      fieldErrors: error.flatten().fieldErrors,
    };
  }
  if (error instanceof FamilyError) {
    const message: FamilyActionState["message"] =
      error.code === "UNAUTHENTICATED"
        ? "errors.unauthenticated"
        : error.code === "FORBIDDEN"
          ? "errors.forbidden"
          : error.code === "PARENT_PROFILE_REQUIRED"
            ? "errors.parentRequired"
            : error.code === "USERNAME_TAKEN"
              ? "errors.usernameTaken"
              : error.code === "LAST_PARENT_LINK"
                ? "errors.lastParent"
                : error.code === "STUDENT_NOT_FOUND" ||
                    error.code === "PARENT_NOT_FOUND" ||
                    error.code === "LINK_NOT_FOUND"
                  ? "errors.notFound"
                  : error.status < 500
                    ? "errors.invalid"
                    : "errors.generic";
    return { status: "error", message, fieldErrors: {} };
  }
  return { status: "error", message: "errors.generic", fieldErrors: {} };
}

export async function saveParentProfileAction(
  _previous: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  try {
    const context = await currentFamilyContext();
    authorizeParentWorkspace(context.actor);
    const input = parentProfileInputSchema.parse({
      fullName: nullableString(formData, "fullName") ?? "",
      phone: nullableString(formData, "phone"),
      contentLanguagePreference: nullableString(formData, "contentLanguagePreference"),
    });
    const existing = await context.database.findParentProfileByUserId(context.actor.userId);
    if (existing) {
      await updateParentProfile(context.database, context.actor, input);
    } else {
      await createParentProfile(context.database, context.actor, input);
    }
    revalidatePath("/families");
    return { status: "success", message: "saved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function createStudentAction(
  _previous: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  try {
    const context = await currentFamilyContext();
    authorizeParentWorkspace(context.actor);
    const isAdultLearner = checked(formData, "isAdultLearner");
    const input = createStudentInputSchema.parse({
      username: nullableString(formData, "username") ?? "",
      preferredName: nullableString(formData, "preferredName") ?? "",
      gradeLevel: nullableString(formData, "gradeLevel"),
      isAdultLearner,
      usState: nullableString(formData, "usState"),
      dobYearMonth: isAdultLearner ? null : nullableString(formData, "dobYearMonth"),
      ageBand: isAdultLearner ? null : nullableString(formData, "ageBand"),
      primaryTimezone: nullableString(formData, "primaryTimezone") ?? "",
      locale: nullableString(formData, "locale") ?? "en",
      relationship: nullableString(formData, "relationship") ?? "parent",
    });
    await createStudentUnderParent(context.database, context.actor, input);
    revalidatePath("/families");
    return { status: "success", message: "studentCreated", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function correctStudentAction(
  _previous: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  try {
    const context = await currentFamilyContext();
    const studentProfileId = nullableString(formData, "studentProfileId") ?? "";
    await authorizeStudentRelationship(
      context.database,
      context.actor,
      studentProfileId,
      "student.manage_profile",
    );
    const isAdultLearner = checked(formData, "isAdultLearner");
    const input = studentProfileInputSchema.parse({
      preferredName: nullableString(formData, "preferredName") ?? "",
      gradeLevel: nullableString(formData, "gradeLevel"),
      isAdultLearner,
      usState: nullableString(formData, "usState"),
      dobYearMonth: isAdultLearner ? null : nullableString(formData, "dobYearMonth"),
      ageBand: isAdultLearner ? null : nullableString(formData, "ageBand"),
    });
    await correctStudentInfo(
      context.database,
      context.actor,
      studentProfileId,
      input,
      nullableString(formData, "reason") ?? "",
    );
    revalidatePath(`/families/${studentProfileId}`);
    revalidatePath("/families");
    return { status: "success", message: "saved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function saveInterestsAction(
  _previous: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  try {
    const context = await currentFamilyContext();
    const studentProfileId = nullableString(formData, "studentProfileId") ?? "";
    await authorizeStudentRelationship(
      context.database,
      context.actor,
      studentProfileId,
      "student.manage_profile",
    );
    const rawInterests = nullableString(formData, "interests") ?? "";
    const input = interestsInputSchema.parse({
      interests: rawInterests
        .split(",")
        .map((interest) => interest.trim())
        .filter(Boolean),
      reason: nullableString(formData, "reason") ?? "",
    });
    await replaceStudentInterests(context.database, context.actor, studentProfileId, input);
    revalidatePath(`/families/${studentProfileId}`);
    return { status: "success", message: "saved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function savePreferencesAction(
  _previous: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  try {
    const context = await currentFamilyContext();
    const studentProfileId = nullableString(formData, "studentProfileId") ?? "";
    await authorizeStudentRelationship(
      context.database,
      context.actor,
      studentProfileId,
      "student.manage_profile",
    );
    const input = preferencesInputSchema.parse({
      preferredLessonStyle: nullableString(formData, "preferredLessonStyle"),
      availabilityNotes: nullableString(formData, "availabilityNotes"),
      notes: nullableString(formData, "notes"),
      reason: nullableString(formData, "reason") ?? "",
    });
    await updateStudentPreferences(context.database, context.actor, studentProfileId, input);
    revalidatePath(`/families/${studentProfileId}`);
    return { status: "success", message: "saved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function linkStudentAction(
  _previous: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  try {
    const context = await currentFamilyContext();
    const studentProfileId = nullableString(formData, "studentProfileId") ?? "";
    await authorizeStudentRelationship(
      context.database,
      context.actor,
      studentProfileId,
      "student.manage_profile",
    );
    const input = linkStudentInputSchema.parse({
      parentProfileId: nullableString(formData, "parentProfileId") ?? "",
      studentProfileId,
      relationship: nullableString(formData, "relationship") ?? "parent",
      isPrimary: checked(formData, "isPrimary"),
      reason: nullableString(formData, "reason") ?? "",
    });
    await linkStudent(context.database, context.actor, input);
    revalidatePath(`/families/${studentProfileId}`);
    return { status: "success", message: "saved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function unlinkStudentAction(
  _previous: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  try {
    const context = await currentFamilyContext();
    const studentProfileId = nullableString(formData, "studentProfileId") ?? "";
    await authorizeStudentRelationship(
      context.database,
      context.actor,
      studentProfileId,
      "student.manage_profile",
    );
    const input = unlinkStudentInputSchema.parse({
      parentProfileId: nullableString(formData, "parentProfileId") ?? "",
      studentProfileId,
      reason: nullableString(formData, "reason") ?? "",
    });
    await unlinkStudent(context.database, context.actor, input);
    revalidatePath("/families");
    return { status: "success", message: "unlinked", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

// `./dispatch` directly, not the `@app/notifications` barrel: the barrel re-exports `./push`,
// which currently has an unrelated pre-existing type error (`packages/notifications/src/push.ts`,
// outside this module's file scope) that would otherwise fail `next build`'s type-check pass the
// moment anything in `apps/web` pulls the barrel in. `dispatch.ts` only imports `./templates`, so
// this sidesteps that without touching `packages/notifications`.
import { notify } from "@app/notifications/dispatch";

import { ConsentError } from "../../../../../packages/domain/consent/errors";
import type { ConsentNotifier } from "../../../../../packages/domain/consent/models";
import { recordConsentInputSchema } from "../../../../../packages/domain/consent/schemas";
import { activateStudent, recordConsent } from "../../../../../packages/domain/consent/services";
import type { ConsentActionState } from "./action-state";
import { authorizeConsentAction } from "./authorization";
import { currentConsentContext } from "./context";

/** `@app/notifications`'s real `notify` satisfies `ConsentNotifier` structurally — see the consent
 * package README, "Notification wiring", for why the domain layer takes this as a parameter
 * instead of importing `@app/notifications` itself. */
const notifier: ConsentNotifier = { notify };

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function errorState(error: unknown): ConsentActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: "errors.invalid",
      fieldErrors: error.flatten().fieldErrors,
    };
  }
  if (error instanceof ConsentError) {
    const message: ConsentActionState["message"] =
      error.code === "UNAUTHENTICATED"
        ? "errors.unauthenticated"
        : error.code === "FORBIDDEN"
          ? "errors.forbidden"
          : error.code === "STUDENT_NOT_FOUND"
            ? "errors.notFound"
            : error.code === "PARENT_PROFILE_REQUIRED"
              ? "errors.parentRequired"
              : error.code === "CONTACT_VERIFICATION_REQUIRED"
                ? "errors.contactVerificationRequired"
                : error.code === "CONSENT_NOT_APPLICABLE"
                  ? "errors.consentNotApplicable"
                  : error.code === "CONSENT_METHOD_NOT_SUPPORTED"
                    ? "errors.methodNotSupported"
                    : error.code === "CONSENT_VERIFICATION_FAILED"
                      ? "errors.verificationFailed"
                      : error.code === "CONSENT_REQUIRED"
                        ? "errors.consentRequired"
                        : error.code === "FAMILY_NOT_READY"
                          ? "errors.familyNotReady"
                          : error.code === "ACCOUNT_SUSPENDED"
                            ? "errors.accountSuspended"
                            : error.status < 500
                              ? "errors.invalid"
                              : "errors.generic";
    return { status: "error", message, fieldErrors: {} };
  }
  return { status: "error", message: "errors.generic", fieldErrors: {} };
}

export async function recordConsentAction(
  _previous: ConsentActionState,
  formData: FormData,
): Promise<ConsentActionState> {
  try {
    const context = await currentConsentContext();
    const studentProfileId = nullableString(formData, "studentProfileId") ?? "";
    await authorizeConsentAction(context.familyDatabase, context.actor, studentProfileId);
    const input = recordConsentInputSchema.parse({
      studentProfileId,
      noticeAcknowledged: checked(formData, "noticeAcknowledged"),
      method: nullableString(formData, "method") ?? "signed_form",
      evidence: {
        typedFullName: nullableString(formData, "typedFullName") ?? "",
        attestationPhrase: nullableString(formData, "attestationPhrase") ?? "",
      },
    });
    await recordConsent(context.database, context.familyDatabase, notifier, context.actor, input);
    revalidatePath(`/consent/${studentProfileId}`);
    revalidatePath("/consent");
    return { status: "success", message: "consentRecorded", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function activateStudentAction(
  _previous: ConsentActionState,
  formData: FormData,
): Promise<ConsentActionState> {
  try {
    const context = await currentConsentContext();
    const studentProfileId = nullableString(formData, "studentProfileId") ?? "";
    await authorizeConsentAction(context.familyDatabase, context.actor, studentProfileId);
    await activateStudent(
      context.database,
      context.familyDatabase,
      notifier,
      context.actor,
      studentProfileId,
    );
    revalidatePath(`/consent/${studentProfileId}`);
    revalidatePath("/consent");
    return { status: "success", message: "activated", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

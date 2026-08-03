"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  buildSignedOutPath,
  expiredSessionCookieAttributes,
  resolveRedirectLocale,
} from "../../../(auth)/logout/logic";
import type { SessionsActionState } from "./action-state";
import { currentSessionsContext, SessionsUnauthenticatedError } from "./context";
import { performRevokeAllDevices, performRevokeSession } from "./logic";
import { sessionsDeps } from "./runtime";

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
const LOCALE_HEADER = "x-locale";

async function requestIp(): Promise<string | null> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function revokeSessionAction(
  _previous: SessionsActionState,
  formData: FormData,
): Promise<SessionsActionState> {
  try {
    const context = await currentSessionsContext();
    const targetSessionId = String(formData.get("sessionId") ?? "").trim();
    const outcome = await performRevokeSession(sessionsDeps().redis, {
      targetSessionId,
      actorUserId: context.userId,
    });
    if (outcome === "not_found_or_forbidden") {
      return { status: "error", message: "errors.notFound" };
    }
    revalidatePath("/settings/sessions");
    return { status: "success", message: "feedback.revoked" };
  } catch (error) {
    if (error instanceof SessionsUnauthenticatedError) redirect("/login");
    throw error;
  }
}

/**
 * "Log out of all devices" ends *this* session too (see `logic.ts`'s file comment), so — same as
 * an ordinary logout — this clears the cookie and lands on `/signed-out`, rather than re-rendering
 * a settings page for a session that no longer exists.
 */
export async function revokeAllDevicesAction(
  _previous: SessionsActionState,
  _formData: FormData,
): Promise<SessionsActionState> {
  const context = await currentSessionsContext().catch((error: unknown) => {
    if (error instanceof SessionsUnauthenticatedError) redirect("/login");
    throw error;
  });

  await performRevokeAllDevices(sessionsDeps(), {
    userId: context.userId,
    ipAddress: await requestIp(),
  });

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale = resolveRedirectLocale(
    requestHeaders.get(LOCALE_HEADER),
    cookieStore.get(LOCALE_COOKIE_NAME)?.value ?? null,
  );
  const cookie = expiredSessionCookieAttributes(process.env.NODE_ENV);
  cookieStore.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });

  redirect(buildSignedOutPath(locale));
}

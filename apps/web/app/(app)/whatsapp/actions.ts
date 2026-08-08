"use server";

import { createWhatsAppProvider, type WhatsAppProviderConfig } from "@app/whatsapp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isWhatsAppError } from "../../../../../packages/domain/whatsapp/errors";
import type { WhatsAppSender } from "../../../../../packages/domain/whatsapp/models";
import { WHATSAPP_REMINDER_LEAD_MINUTES_OPTIONS } from "../../../../../packages/domain/whatsapp/schemas";
import { updateGroupPreferences, syncGroupMembership } from "../../../../../packages/domain/whatsapp/services";
import { currentWhatsAppContext } from "./context";

// Reads these three WHATSAPP_* vars straight off process.env rather than through
// @app/config/env's `serverEnv` — same reasoning as the marketing home page's
// `organizationJsonLd` comment: `serverEnv` eagerly validates the *entire* app's required
// server config (database, Redis, Zoom, Sentry, KMS, …) at import time, which is far too wide
// a blast radius for three vars that `packages/config/src/schema.ts` already treats as optional.
function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function whatsappProviderConfig(): WhatsAppProviderConfig {
  const accessToken = optionalEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = optionalEnv("WHATSAPP_PHONE_NUMBER_ID");
  if (!accessToken || !phoneNumberId) {
    return { kind: "disabled" };
  }
  return {
    kind: "meta_cloud_api",
    accessToken,
    phoneNumberId,
    apiVersion: optionalEnv("WHATSAPP_API_VERSION"),
  };
}

/** Adapter around `@app/whatsapp`'s real provider satisfying the domain module's locally-declared `WhatsAppSender`. */
function buildSender(): WhatsAppSender {
  const provider = createWhatsAppProvider(whatsappProviderConfig());
  return {
    async sendInviteLink(input) {
      await provider.sendTemplateMessage({
        to: input.phone,
        template: "group_invite",
        languageCode: input.locale,
        variables: [input.studentDisplayName, input.inviteLink],
      });
    },
    async sendGroupMessage(providerGroupId, body) {
      await provider.sendGroupTextMessage(providerGroupId, body);
    },
    async createGroup(subject, description) {
      return provider.createGroup(subject, description);
    },
  };
}

function parseLeadMinutes(raw: FormDataEntryValue | null): number {
  const parsed = Number(raw);
  const match = WHATSAPP_REMINDER_LEAD_MINUTES_OPTIONS.find((minutes) => minutes === parsed);
  return match ?? WHATSAPP_REMINDER_LEAD_MINUTES_OPTIONS[1];
}

export async function updateWhatsAppPreferencesAction(formData: FormData): Promise<void> {
  const studentProfileId = String(formData.get("studentProfileId") ?? "");
  try {
    const context = await currentWhatsAppContext();
    await updateGroupPreferences(
      context.database,
      context.familyDatabase,
      context.consentDatabase,
      context.actor,
      {
        studentProfileId,
        isEnabled: formData.get("isEnabled") === "on",
        reminderLeadMinutes: parseLeadMinutes(formData.get("reminderLeadMinutes")),
        includeChild: formData.get("includeChild") === "on",
      },
    );
  } catch (error) {
    if (isWhatsAppError(error) && error.code === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
  revalidatePath(`/whatsapp/${studentProfileId}`);
}

export async function syncWhatsAppGroupAction(formData: FormData): Promise<void> {
  const studentProfileId = String(formData.get("studentProfileId") ?? "");
  try {
    const context = await currentWhatsAppContext();
    await syncGroupMembership(
      context.database,
      context.familyDatabase,
      context.consentDatabase,
      buildSender(),
      context.actor,
      studentProfileId,
    );
  } catch (error) {
    if (isWhatsAppError(error) && error.code === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
  revalidatePath(`/whatsapp/${studentProfileId}`);
}

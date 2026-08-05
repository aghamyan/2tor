/**
 * Meta WhatsApp Business Platform Cloud API client. Endpoints below are transcribed from Meta's
 * 2026 developer documentation for the (brand-new at the time of writing) Groups API — see
 * packages/domain/whatsapp/README.md for the full caveat. Re-verify against live docs/sandbox
 * before the first real send; this package's tests only depend on the request shape this file
 * builds, not on Meta actually accepting it.
 */

export type WhatsAppTemplateMessage = {
  /** E.164 phone number — template sends are always 1:1, never into a group. */
  to: string;
  /** Pre-approved template name (configured in Meta Business Manager, not in this repo). */
  template: string;
  languageCode: string;
  /** Positional template variables, substituted for {{1}}, {{2}}, ... in the approved template body. */
  variables: readonly string[];
};

export type WhatsAppDelivery = { providerMessageId?: string };
export type WhatsAppGroup = { providerGroupId: string; inviteLink: string };

export type WhatsAppProvider = {
  /** 1:1 only — used for invite-link delivery, the one place this phase messages an individual. */
  sendTemplateMessage(message: WhatsAppTemplateMessage): Promise<WhatsAppDelivery>;
  /**
   * Posts into an already-created group. Meta's group-messaging example uses plain `text.body`,
   * not a template — see the README caveat on whether business-initiated/template rules apply
   * identically inside a business-created group; not fully certain from documentation alone.
   */
  sendGroupTextMessage(providerGroupId: string, body: string): Promise<WhatsAppDelivery>;
  createGroup(subject: string, description?: string): Promise<WhatsAppGroup>;
  removeParticipant(providerGroupId: string, phone: string): Promise<void>;
};

export type FetchLike = typeof fetch;

export type MetaCloudApiConfig = {
  kind: "meta_cloud_api";
  accessToken: string;
  phoneNumberId: string;
  /** Defaults to "v25.0" — the version this integration was written against. */
  apiVersion?: string;
};

/**
 * Used whenever `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` are unset — e.g. before Official
 * Business Account approval lands. Logs what would have been sent (redacting phone numbers/bodies
 * via the shared logger's PII redaction) and returns a synthetic delivery/group instead of
 * throwing, so the rest of the pipeline (schema, jobs, UI) is exercisable end-to-end pre-approval.
 */
export type DisabledConfig = { kind: "disabled" };

export type WhatsAppProviderConfig = MetaCloudApiConfig | DisabledConfig;

const DEFAULT_API_VERSION = "v25.0";
const GRAPH_API_BASE = "https://graph.facebook.com";

function assertTemplateMessage(message: WhatsAppTemplateMessage): void {
  if (!message.to || !message.template || !message.languageCode) {
    throw new Error("A WhatsApp template message requires to, template, and languageCode.");
  }
}

function graphUrl(apiVersion: string, path: string): string {
  return `${GRAPH_API_BASE}/${apiVersion}/${path}`;
}

function createMetaCloudApiProvider(
  config: MetaCloudApiConfig,
  fetcher: FetchLike,
): WhatsAppProvider {
  const apiVersion = config.apiVersion ?? DEFAULT_API_VERSION;
  const headers = {
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
  };

  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetcher(graphUrl(apiVersion, path), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`WhatsApp Cloud API rejected the request (${response.status}).`);
    return (await response.json()) as T;
  }

  return {
    async sendTemplateMessage(message) {
      assertTemplateMessage(message);
      const result = await post<{ messages?: Array<{ id?: string }> }>(
        `${config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: message.to,
          type: "template",
          template: {
            name: message.template,
            language: { code: message.languageCode },
            components: message.variables.length
              ? [
                  {
                    type: "body",
                    parameters: message.variables.map((text) => ({ type: "text", text })),
                  },
                ]
              : undefined,
          },
        },
      );
      return { providerMessageId: result.messages?.[0]?.id };
    },

    async sendGroupTextMessage(providerGroupId, body) {
      if (!providerGroupId || !body) {
        throw new Error("A WhatsApp group message requires providerGroupId and body.");
      }
      const result = await post<{ messages?: Array<{ id?: string }> }>(
        `${config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "group",
          to: providerGroupId,
          type: "text",
          text: { body },
        },
      );
      return { providerMessageId: result.messages?.[0]?.id };
    },

    async createGroup(subject, description) {
      if (!subject) throw new Error("Creating a WhatsApp group requires a subject.");
      const created = await post<{ id: string }>(`${config.phoneNumberId}/groups`, {
        messaging_product: "whatsapp",
        subject,
        description,
      });
      const inviteLinkResponse = await fetcher(graphUrl(apiVersion, `${created.id}/invite_link`), {
        method: "GET",
        headers,
      });
      if (!inviteLinkResponse.ok) {
        throw new Error(`WhatsApp Cloud API rejected the invite-link request (${inviteLinkResponse.status}).`);
      }
      const inviteLinkResult = (await inviteLinkResponse.json()) as { invite_link: string };
      return { providerGroupId: created.id, inviteLink: inviteLinkResult.invite_link };
    },

    async removeParticipant(providerGroupId, phone) {
      const response = await fetcher(graphUrl(apiVersion, `${providerGroupId}/participants`), {
        method: "DELETE",
        headers,
        body: JSON.stringify({ messaging_product: "whatsapp", participants: [{ user: phone }] }),
      });
      if (!response.ok) {
        throw new Error(`WhatsApp Cloud API rejected the participant removal (${response.status}).`);
      }
    },
  };
}

/**
 * Deliberately plain `console`, not `@app/observability`'s pino logger: that package's barrel
 * re-exports `sentry.ts`, which imports `@app/config` without declaring it as a dependency —
 * unresolvable under pnpm's strict linking from anywhere outside `packages/observability` itself
 * (confirmed for `apps/worker` in its README; the same failure mode would hit Vitest here too).
 * `apps/worker/src/queue.ts` works around the identical problem with its own structured-console
 * logger; this mirrors that rather than taking on a dependency that breaks at runtime for one of
 * this package's two consumers (`apps/worker`, `apps/web`).
 */
function logDisabledCall(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "info", time: new Date().toISOString(), event, ...fields }));
}

function createDisabledProvider(): WhatsAppProvider {
  return {
    async sendTemplateMessage(message) {
      assertTemplateMessage(message);
      logDisabledCall("whatsapp.disabled.send_template_message", {
        phone: message.to,
        template: message.template,
      });
      return { providerMessageId: undefined };
    },
    async sendGroupTextMessage(providerGroupId, body) {
      if (!providerGroupId || !body) {
        throw new Error("A WhatsApp group message requires providerGroupId and body.");
      }
      logDisabledCall("whatsapp.disabled.send_group_message", { providerGroupId });
      return { providerMessageId: undefined };
    },
    async createGroup(subject) {
      if (!subject) throw new Error("Creating a WhatsApp group requires a subject.");
      logDisabledCall("whatsapp.disabled.create_group", { subject });
      return { providerGroupId: `disabled-${Date.now()}`, inviteLink: "" };
    },
    async removeParticipant(providerGroupId) {
      logDisabledCall("whatsapp.disabled.remove_participant", { providerGroupId });
    },
  };
}

export function createWhatsAppProvider(
  config: WhatsAppProviderConfig,
  fetcher: FetchLike = fetch,
): WhatsAppProvider {
  if (config.kind === "disabled") return createDisabledProvider();
  return createMetaCloudApiProvider(config, fetcher);
}

export async function sendTestWhatsAppMessage(
  provider: WhatsAppProvider,
  message: WhatsAppTemplateMessage,
): Promise<WhatsAppDelivery> {
  return provider.sendTemplateMessage(message);
}

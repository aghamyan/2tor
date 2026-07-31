import { createEmailProvider, type EmailProviderConfig } from "@app/email";
import type { NotificationType, RenderedNotification } from "@app/notifications";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "./_schema";

type Payload = {
  userId: string;
  to: string;
  type: NotificationType;
  rendered: RenderedNotification;
};
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    typeof value.userId === "string" &&
    typeof value.to === "string" &&
    typeof value.type === "string" &&
    isObject(value.rendered) &&
    typeof value.rendered.emailSubject === "string" &&
    typeof value.rendered.emailText === "string",
);

function emailConfig(): EmailProviderConfig {
  if (process.env.RESEND_API_KEY) return { kind: "resend", apiKey: process.env.RESEND_API_KEY };
  if (
    process.env.SES_ACCESS_KEY_ID &&
    process.env.SES_SECRET_ACCESS_KEY &&
    process.env.SES_REGION
  ) {
    return {
      kind: "ses",
      accessKeyId: process.env.SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
      region: process.env.SES_REGION,
    };
  }
  throw new Error(
    "Configure RESEND_API_KEY or SES credentials before processing notification email jobs.",
  );
}

export default defineJob({
  name: "notifications.send-email",
  queue: "notifications",
  schema,
  async handler(data, ctx) {
    const from = process.env.NOTIFICATIONS_FROM_EMAIL;
    if (!from) throw new Error("NOTIFICATIONS_FROM_EMAIL is required for notification email jobs.");
    const provider = createEmailProvider(emailConfig());
    await provider.send({
      from,
      to: data.to,
      subject: data.rendered.emailSubject,
      text: data.rendered.emailText,
      tags: { notification_type: data.type, template_version: String(data.rendered.version) },
    });
    ctx.log.info({ userId: data.userId, type: data.type }, "notification email sent");
  },
  options: {
    idempotent: true,
    idempotencyKey: (data) =>
      `${data.userId}:${data.type}:${data.rendered.version}:${data.rendered.emailText}`,
  },
});

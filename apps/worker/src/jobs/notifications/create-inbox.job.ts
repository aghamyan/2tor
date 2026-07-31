import { createDb, notifications } from "@app/db";
import {
  notificationCategory,
  type NotificationType,
  type RenderedNotification,
} from "@app/notifications";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "./_schema";

type Payload = {
  userId: string;
  type: NotificationType;
  rendered: RenderedNotification;
  relatedEntity?: { type: string; id: string; enduring: boolean };
};
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    typeof value.userId === "string" &&
    typeof value.type === "string" &&
    isObject(value.rendered) &&
    typeof value.rendered.title === "string" &&
    typeof value.rendered.body === "string",
);

export default defineJob({
  name: "notifications.create-inbox",
  queue: "notifications",
  schema,
  async handler(data, ctx) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for inbox notification jobs.");
    const db = createDb(databaseUrl);
    await db.insert(notifications).values({
      userId: data.userId,
      channel: "in_app",
      category: notificationCategory(data.type),
      title: data.rendered.title,
      body: data.rendered.body,
      status: "sent",
      sentAt: new Date(),
      relatedEntityType: data.relatedEntity?.type,
      relatedEntityId: data.relatedEntity?.id,
    });
    ctx.log.info({ userId: data.userId, type: data.type }, "notification inbox record created");
  },
  options: {
    idempotent: true,
    idempotencyKey: (data) =>
      `${data.userId}:${data.type}:${data.relatedEntity?.id ?? data.rendered.body}`,
  },
});

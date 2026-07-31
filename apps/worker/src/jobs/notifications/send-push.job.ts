import {
  createVapidPushSender,
  type NotificationType,
  type PushSubscription,
  type RenderedNotification,
} from "@app/notifications";
import { defineJob } from "../../job";
import { isObject, objectSchema } from "./_schema";

type Payload = {
  userId: string;
  type: NotificationType;
  subscription: PushSubscription;
  rendered: RenderedNotification;
};
const schema = objectSchema<Payload>(
  (value): value is Payload =>
    isObject(value) &&
    typeof value.userId === "string" &&
    typeof value.type === "string" &&
    isObject(value.subscription) &&
    typeof value.subscription.endpoint === "string" &&
    isObject(value.rendered) &&
    typeof value.rendered.title === "string" &&
    typeof value.rendered.body === "string",
);

export default defineJob({
  name: "notifications.send-push",
  queue: "notifications",
  schema,
  async handler(data, ctx) {
    const { WEB_PUSH_VAPID_SUBJECT, WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY } =
      process.env;
    if (!WEB_PUSH_VAPID_SUBJECT || !WEB_PUSH_VAPID_PUBLIC_KEY || !WEB_PUSH_VAPID_PRIVATE_KEY)
      throw new Error("VAPID subject, public key, and private key are required for Web Push.");
    await createVapidPushSender({
      subject: WEB_PUSH_VAPID_SUBJECT,
      publicKey: WEB_PUSH_VAPID_PUBLIC_KEY,
      privateKey: WEB_PUSH_VAPID_PRIVATE_KEY,
    }).send(data.subscription, { title: data.rendered.title, body: data.rendered.body });
    ctx.log.info({ userId: data.userId, type: data.type }, "notification push sent");
  },
  options: {
    idempotent: true,
    idempotencyKey: (data) =>
      `${data.userId}:${data.type}:${data.subscription.endpoint}:${data.rendered.version}`,
  },
});

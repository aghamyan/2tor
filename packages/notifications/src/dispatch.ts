import {
  renderNotificationTemplate,
  type NotificationType,
  type TemplateAudience,
  type TemplateData,
  type TemplateLocale,
} from "./templates";

export const notificationChannels = ["email", "push", "inbox"] as const;
export type NotificationChannel = (typeof notificationChannels)[number];
export type NotificationPreference = {
  category: string;
  channel: NotificationChannel;
  isEnabled: boolean;
};

export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export type NotificationRecipient = {
  locale: TemplateLocale;
  /** `child` receives the deliberately age-appropriate critical template variant. */
  accountKind: "adult" | "child";
  email?: string;
  pushSubscriptions: readonly PushSubscription[];
};

export type NotificationRepository = {
  getRecipient(userId: string): Promise<NotificationRecipient | undefined>;
  getPreferences(userId: string): Promise<readonly NotificationPreference[]>;
};

export type NotificationJob =
  | {
      name: "notifications.send-email";
      payload: {
        userId: string;
        to: string;
        type: NotificationType;
        rendered: ReturnType<typeof renderNotificationTemplate>;
      };
    }
  | {
      name: "notifications.send-push";
      payload: {
        userId: string;
        subscription: PushSubscription;
        type: NotificationType;
        rendered: ReturnType<typeof renderNotificationTemplate>;
      };
    }
  | {
      name: "notifications.create-inbox";
      payload: {
        userId: string;
        type: NotificationType;
        rendered: ReturnType<typeof renderNotificationTemplate>;
        relatedEntity?: { type: string; id: string; enduring: boolean };
      };
    };

export type NotificationJobQueue = { enqueue(job: NotificationJob): Promise<void> };

/** Minimal BullMQ-compatible adapter; callers retain ownership of the Redis connection/Queue. */
export function createWorkerNotificationQueue(queue: {
  add(name: string, data: unknown): Promise<unknown>;
}): NotificationJobQueue {
  return { enqueue: async (job) => void (await queue.add(job.name, job.payload)) };
}

export type ChannelPolicy = Partial<Record<NotificationChannel, boolean>>;
export type NotifyInput = {
  userId: string;
  type: NotificationType;
  /** Per-call channel allow-list. It can narrow optional delivery, never bypass mandatory delivery. */
  channelPolicy?: ChannelPolicy;
  data: TemplateData;
  relatedEntity?: { type: string; id: string; enduring?: boolean };
};

const mandatoryTypes = new Set<NotificationType>([
  "verification",
  "consent_status",
  "security_change",
  "lesson_scheduled",
  "lesson_canceled",
  "payment_receipt",
  "payment_failure",
  "payment_refund",
  "privacy_request",
  "safety_notice",
]);
const childCriticalTypes = new Set<NotificationType>([
  "verification",
  "consent_status",
  "security_change",
  "lesson_scheduled",
  "lesson_canceled",
  "safety_notice",
]);
const promotionalTypes = new Set<NotificationType>(["promotional"]);

export function isMandatoryNotification(type: NotificationType): boolean {
  return mandatoryTypes.has(type);
}

export function notificationCategory(type: NotificationType): string {
  if (type.startsWith("lesson_")) return "schedule";
  if (type.startsWith("payment_")) return "payment";
  if (type === "verification" || type === "security_change") return "account";
  if (type === "consent_status" || type === "privacy_request") return "privacy";
  if (type === "safety_notice") return "safety";
  if (type === "promotional") return "promotional";
  return "updates";
}

function isEnabled(
  type: NotificationType,
  channel: NotificationChannel,
  recipient: NotificationRecipient,
  preferences: readonly NotificationPreference[],
  policy: ChannelPolicy | undefined,
): boolean {
  const forcedForChild = recipient.accountKind === "child" && childCriticalTypes.has(type);
  // Mandatory and child-critical notices are deliberately not suppressible by user preference
  // or a caller's policy. Missing delivery endpoints are handled separately by the dispatcher.
  if (mandatoryTypes.has(type) || forcedForChild) return true;
  // Promotional messages are parent-controlled: never send directly to a child account.
  if (recipient.accountKind === "child" && promotionalTypes.has(type)) return false;
  if (policy?.[channel] === false) return false;
  const preference = preferences.find(
    (item) => item.category === notificationCategory(type) && item.channel === channel,
  );
  return preference?.isEnabled ?? true;
}

export type NotificationDispatcher = {
  notify(
    input: NotifyInput,
  ): Promise<{ dispatched: NotificationChannel[]; skipped: NotificationChannel[] }>;
};

export function createNotificationDispatcher(
  repository: NotificationRepository,
  queue: NotificationJobQueue,
): NotificationDispatcher {
  return {
    async notify(input) {
      const recipient = await repository.getRecipient(input.userId);
      if (!recipient) throw new Error(`Cannot notify unknown user "${input.userId}".`);
      const preferences = await repository.getPreferences(input.userId);
      const audience: TemplateAudience =
        recipient.accountKind === "child" && childCriticalTypes.has(input.type)
          ? "child"
          : "default";
      const rendered = renderNotificationTemplate(
        input.type,
        recipient.locale,
        input.data,
        audience,
      );
      const relatedEntity = input.relatedEntity
        ? { ...input.relatedEntity, enduring: input.relatedEntity.enduring ?? false }
        : undefined;
      const dispatched: NotificationChannel[] = [];
      const skipped: NotificationChannel[] = [];

      if (
        isEnabled(input.type, "email", recipient, preferences, input.channelPolicy) &&
        recipient.email
      ) {
        await queue.enqueue({
          name: "notifications.send-email",
          payload: { userId: input.userId, to: recipient.email, type: input.type, rendered },
        });
        dispatched.push("email");
      } else skipped.push("email");

      if (
        isEnabled(input.type, "push", recipient, preferences, input.channelPolicy) &&
        recipient.pushSubscriptions.length > 0
      ) {
        await Promise.all(
          recipient.pushSubscriptions.map((subscription) =>
            queue.enqueue({
              name: "notifications.send-push",
              payload: { userId: input.userId, subscription, type: input.type, rendered },
            }),
          ),
        );
        dispatched.push("push");
      } else skipped.push("push");

      if (isEnabled(input.type, "inbox", recipient, preferences, input.channelPolicy)) {
        await queue.enqueue({
          name: "notifications.create-inbox",
          payload: { userId: input.userId, type: input.type, rendered, relatedEntity },
        });
        dispatched.push("inbox");
      } else skipped.push("inbox");
      return { dispatched, skipped };
    },
  };
}

let configuredDispatcher: NotificationDispatcher | undefined;

/** Configure once at the composition root; domain modules can then call `notify(...)`. */
export function configureNotifications(dispatcher: NotificationDispatcher): void {
  configuredDispatcher = dispatcher;
}

export async function notify(
  input: NotifyInput,
): Promise<{ dispatched: NotificationChannel[]; skipped: NotificationChannel[] }> {
  if (!configuredDispatcher)
    throw new Error(
      "Notifications are not configured. Call configureNotifications() at the composition root.",
    );
  return configuredDispatcher.notify(input);
}

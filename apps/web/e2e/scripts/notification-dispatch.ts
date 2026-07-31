import { createNotificationDispatcher } from "@app/notifications/dispatch";

/**
 * Copied into the disposable Next workspace as app/api/consent/_e2e-notifier.ts. It keeps the
 * production template/channel dispatcher in the route while making the terminal queue a no-op.
 */
const dispatcher = createNotificationDispatcher(
  {
    async getRecipient() {
      return {
        locale: "en",
        accountKind: "adult",
        pushSubscriptions: [],
      };
    },
    async getPreferences() {
      return [];
    },
  },
  {
    async enqueue() {},
  },
);

export const notify = dispatcher.notify;

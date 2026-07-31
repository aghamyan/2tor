import { describe, expect, it } from "vitest";
import {
  createNotificationDispatcher,
  type NotificationJob,
  type NotificationRecipient,
} from "./dispatch";
import { renderNotificationTemplate } from "./templates";

const adult: NotificationRecipient = {
  locale: "en",
  accountKind: "adult",
  email: "parent@example.test",
  pushSubscriptions: [],
};

describe("notification dispatcher", () => {
  it("honors a disabled optional preference", async () => {
    const jobs: NotificationJob[] = [];
    const dispatcher = createNotificationDispatcher(
      {
        getRecipient: async () => adult,
        getPreferences: async () => [
          { category: "updates", channel: "email", isEnabled: false },
          { category: "updates", channel: "inbox", isEnabled: false },
        ],
      },
      { enqueue: async (job) => void jobs.push(job) },
    );
    const result = await dispatcher.notify({
      userId: "user_1",
      type: "progress_update",
      data: { actionUrl: "https://app.test/progress" },
    });
    expect(result.dispatched).toEqual([]);
    expect(jobs).toEqual([]);
  });

  it("always dispatches mandatory notifications despite preference and caller policy", async () => {
    const jobs: NotificationJob[] = [];
    const dispatcher = createNotificationDispatcher(
      {
        getRecipient: async () => adult,
        getPreferences: async () => [
          { category: "account", channel: "email", isEnabled: false },
          { category: "account", channel: "inbox", isEnabled: false },
        ],
      },
      { enqueue: async (job) => void jobs.push(job) },
    );
    const result = await dispatcher.notify({
      userId: "user_1",
      type: "verification",
      channelPolicy: { email: false, inbox: false },
      data: { actionUrl: "https://app.test/verify" },
    });
    expect(result.dispatched).toEqual(["email", "inbox"]);
    expect(jobs.map((job) => job.name)).toEqual([
      "notifications.send-email",
      "notifications.create-inbox",
    ]);
  });

  it("rejects a template with a missing variable", () => {
    expect(() =>
      renderNotificationTemplate("payment_failure", "hy", { amount: 5000, currency: "AMD" }),
    ).toThrow("missing variable(s): actionUrl");
  });
});

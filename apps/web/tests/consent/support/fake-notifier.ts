import type {
  ConsentNotification,
  ConsentNotifier,
} from "../../../../../packages/domain/consent/models";

/** In-memory `ConsentNotifier` — never touches `@app/notifications`, so tests stay dependency-free. */
export class FakeConsentNotifier implements ConsentNotifier {
  readonly calls: ConsentNotification[] = [];

  async notify(notification: ConsentNotification): Promise<unknown> {
    this.calls.push(notification);
    return { dispatched: ["inbox"], skipped: [] };
  }
}

"use client";

import type { AssessmentEventType } from "../../../../../packages/domain/assessments/models";

export type ProctoringMetadata = Record<string, string | number | boolean | null>;

export interface QueuedSignal {
  eventType: AssessmentEventType;
  metadata: ProctoringMetadata | null;
  occurredAtMs: number;
}

const FLUSH_INTERVAL_MS = 2_000;
const MAX_QUEUE = 25;

/**
 * Every proctoring guard funnels through here instead of calling `fetch` directly. Signals are
 * coalesced and sent in batches (one `POST .../events` per flush, not one per keystroke-adjacent
 * detector tick) — a MediaPipe loop or a chatty focus guard would otherwise hammer the append-only
 * event log. `stop()` flushes synchronously via `sendBeacon` so the last few signals survive
 * navigation away from the page.
 */
export class SignalBus {
  private queue: QueuedSignal[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private readonly listeners = new Set<(signal: QueuedSignal) => void>();

  /**
   * `onClosed` fires at most once, the first time a flush response reports the attempt is no
   * longer `in_progress` — the server-authoritative signal that a tutor's `auto_submit` integrity
   * policy ended this attempt (see `recordAssessmentSignals` in services.ts). Not reachable via
   * `sendBeacon`, which never returns a response — acceptable since that path only fires on
   * teardown/navigation, when the runner is already leaving.
   */
  constructor(
    private readonly attemptId: string,
    private readonly onClosed?: (attemptStatus: string) => void,
  ) {}

  /** Live mirror for the on-screen suspicion banner — no extra network round trip. */
  onSignal(listener: (signal: QueuedSignal) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(eventType: AssessmentEventType, metadata: ProctoringMetadata | null = null): void {
    if (this.stopped) return;
    const signal: QueuedSignal = { eventType, metadata, occurredAtMs: Date.now() };
    this.queue.push(signal);
    for (const listener of this.listeners) listener(signal);
    if (this.timer === null) {
      this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    }
    if (this.queue.length >= MAX_QUEUE) this.flush();
  }

  flush(useBeacon = false): void {
    if (this.queue.length === 0) return;
    const signals = this.queue.splice(0, this.queue.length);
    const body = JSON.stringify({
      signals: signals.map((signal) => ({
        eventType: signal.eventType,
        clientOccurredAt: new Date(signal.occurredAtMs).toISOString(),
        metadata: signal.metadata,
      })),
    });
    const url = `/api/assessments/attempts/${encodeURIComponent(this.attemptId)}/events`;
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body,
    })
      .then(async (response) => {
        if (!response.ok || !this.onClosed) return;
        const payload = (await response.json()) as { attemptStatus?: string };
        if (payload.attemptStatus && payload.attemptStatus !== "in_progress") {
          this.onClosed(payload.attemptStatus);
        }
      })
      .catch(() => undefined);
  }

  /** Stops accepting new signals and flushes whatever is queued. Call once, on unmount/submit. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush(true);
  }
}

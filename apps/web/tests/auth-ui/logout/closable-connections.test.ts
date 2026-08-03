import { describe, expect, it, vi } from "vitest";

import {
  closeAllConnections,
  registerClosableConnection,
} from "../../../components/auth/logout/closable-connections";

describe("closable-connections registry", () => {
  it("closes every registered connection exactly once and forgets them afterward", () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    registerClosableConnection({ close: closeA });
    registerClosableConnection({ close: closeB });

    closeAllConnections();

    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);

    closeAllConnections();
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);
  });

  it("does not close a connection after it has unregistered", () => {
    const close = vi.fn();
    const unregister = registerClosableConnection({ close });
    unregister();

    closeAllConnections();

    expect(close).not.toHaveBeenCalled();
  });

  it("adapts a polling interval to the same registry via a close() wrapper", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    const id = setInterval(tick, 1000);
    registerClosableConnection({ close: () => clearInterval(id) });

    vi.advanceTimersByTime(2500);
    expect(tick).toHaveBeenCalledTimes(2);

    closeAllConnections();
    vi.advanceTimersByTime(5000);
    expect(tick).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

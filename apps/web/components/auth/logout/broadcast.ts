/**
 * Cross-tab "you have been logged out" signal (task requirement: other open tabs must not keep
 * functioning as authenticated). One mechanism, not two: `BroadcastChannel` is supported in every
 * browser this app targets and in Node (used by the test for this file), so there is no
 * `localStorage`/`storage`-event fallback to also maintain.
 */
const CHANNEL_NAME = "app-auth";
const LOGGED_OUT_MESSAGE = "logged-out";

function hasBroadcastChannel(): boolean {
  return typeof BroadcastChannel !== "undefined";
}

/** Tells every other tab sharing this browser profile that the session just ended. */
export function broadcastLogout(): void {
  if (!hasBroadcastChannel()) return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(LOGGED_OUT_MESSAGE);
  channel.close();
}

/** Subscribes to the signal above. Returns an unsubscribe function. */
export function onLogoutBroadcast(callback: () => void): () => void {
  if (!hasBroadcastChannel()) return () => {};
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const listener = (event: MessageEvent) => {
    if (event.data === LOGGED_OUT_MESSAGE) callback();
  };
  channel.addEventListener("message", listener);
  return () => {
    channel.removeEventListener("message", listener);
    channel.close();
  };
}

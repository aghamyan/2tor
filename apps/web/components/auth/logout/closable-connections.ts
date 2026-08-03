/**
 * A generic registry of "things that must be torn down on logout": open SSE/WebSocket connections
 * and polling timers, reduced to the one shape they all share — `close()`. Task requirement: no
 * live realtime connection may remain authenticated to a destroyed session after logout.
 *
 * As of this task, nothing in the codebase actually opens an SSE/WebSocket connection yet — see
 * `components/app-shell/notification-bell.tsx`'s own file-level comment ("no notifications inbox
 * route... renders once per navigation server-side, not on a live interval"). This registry is
 * forward-looking scaffolding for whichever module adds one first (communication/notifications),
 * verified here with a fake `{ close() }` connection since there is no real one yet to integrate.
 * A `setInterval` polling loop registers itself the same way: `registerClosableConnection({
 * close: () => clearInterval(id) })`.
 */
export interface ClosableConnection {
  close(): void;
}

const connections = new Set<ClosableConnection>();

export function registerClosableConnection(connection: ClosableConnection): () => void {
  connections.add(connection);
  return () => {
    connections.delete(connection);
  };
}

export function closeAllConnections(): void {
  for (const connection of connections) {
    connection.close();
  }
  connections.clear();
}

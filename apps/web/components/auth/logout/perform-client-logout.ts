/**
 * The client-side logout flow, factored out of `logout-button.tsx` as a plain function so it's
 * testable without rendering JSX (this workspace has no jsdom/`@testing-library/react`, and
 * `apps/web/tsconfig.json`'s `"jsx": "preserve"` means Vitest can't transform a `.tsx` file with
 * real JSX at all — see this task's output notes). Every side effect is passed in, so a test can
 * assert exactly what task requirement #6 needs: a successful logout closes realtime connections
 * and broadcasts to other tabs *before* navigating away.
 */
export interface ClientLogoutDeps {
  fetchImpl: typeof fetch;
  closeAllConnections: () => void;
  broadcastLogout: () => void;
  navigate: (path: string) => void;
  /** Returns `/en` or `/hy` — see `logout-button.tsx`'s `currentLocalePrefix`. */
  localePrefix: () => string;
}

export type ClientLogoutResult = { ok: true } | { ok: false };

interface CsrfTokenResponse {
  data: { csrfToken: string | null };
}
interface LogoutResponse {
  data: { redirectTo: string };
}

export async function performClientLogout(deps: ClientLogoutDeps): Promise<ClientLogoutResult> {
  try {
    const prefix = deps.localePrefix();
    const csrfResponse = await deps.fetchImpl(`${prefix}/logout/csrf`);
    const csrfBody: CsrfTokenResponse = csrfResponse.ok
      ? ((await csrfResponse.json()) as CsrfTokenResponse)
      : { data: { csrfToken: null } };

    const headers = new Headers();
    if (csrfBody.data.csrfToken) headers.set("x-csrf-token", csrfBody.data.csrfToken);

    const response = await deps.fetchImpl(`${prefix}/logout`, { method: "POST", headers });
    if (!response.ok) return { ok: false };
    const body = (await response.json()) as LogoutResponse;

    // Tear down client state before navigating away (task requirement #6): any open realtime
    // connection or polling timer registered against this session must not keep running past
    // this point, and other open tabs must be told the session just ended.
    deps.closeAllConnections();
    deps.broadcastLogout();
    deps.navigate(body.data.redirectTo);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

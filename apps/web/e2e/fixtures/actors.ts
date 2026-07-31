import { test as base, expect, type APIRequestContext, type APIResponse } from "@playwright/test";

export type ActorName = "parent" | "student" | "tutor" | "admin" | "approver";

export interface ActorClients {
  parent: APIRequestContext;
  student: APIRequestContext;
  tutor: APIRequestContext;
  admin: APIRequestContext;
  approver: APIRequestContext;
}

export const sessionIds: Record<ActorName, string> = {
  parent: "e2e-parent",
  student: "e2e-student",
  tutor: "e2e-tutor",
  admin: "e2e-admin",
  approver: "e2e-approver",
};

export const test = base.extend<{ actors: ActorClients }>({
  actors: async ({ baseURL, playwright }, provideActors) => {
    if (!baseURL) throw new Error("Playwright baseURL is required.");
    const entries = await Promise.all(
      (Object.keys(sessionIds) as ActorName[]).map(async (name) => {
        const client = await playwright.request.newContext({
          baseURL,
          extraHTTPHeaders: { cookie: `session_id=${sessionIds[name]}` },
        });
        return [name, client] as const;
      }),
    );
    const actors = Object.fromEntries(entries) as unknown as ActorClients;

    // Each domain owns an ioredis singleton configured with enableOfflineQueue=false. Its first
    // request can race the initial connection, so exercise one read-only route per runtime before
    // any journey sends a state-changing request.
    const warm = async (client: APIRequestContext, path: string) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await client.get(path);
        await response.body();
        if (response.status() < 500) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`The ${path} runtime did not become ready.`);
    };
    await Promise.all([
      warm(actors.parent, "/api/families/students?limit=1"),
      warm(actors.parent, "/api/consent/students/sprof_demo_1"),
      warm(actors.admin, "/api/matching/requests"),
      warm(actors.tutor, "/api/scheduling/lessons?limit=1"),
      warm(actors.parent, "/api/payments/invoices?limit=1"),
      warm(actors.admin, "/api/payouts/earnings"),
      warm(actors.admin, "/api/admin/exports"),
      warm(actors.parent, "/api/academics/feedback/fb_demo_1"),
    ]);

    await provideActors(actors);
    await Promise.all(Object.values(actors).map((client) => client.dispose()));
  },
});

export { expect };

export async function expectJson<T>(response: APIResponse, status: number): Promise<T> {
  const body = (await response.json()) as T;
  expect(response.status(), JSON.stringify(body, null, 2)).toBe(status);
  return body;
}

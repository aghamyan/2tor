import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";

interface AxeNode {
  failureSummary?: string;
  html: string;
  target: string[];
}

interface AxeViolation {
  description: string;
  help: string;
  helpUrl: string;
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  nodes: AxeNode[];
}

interface AxeResult {
  violations: AxeViolation[];
}

type AxeWindow = Window & {
  axe: {
    run: (
      context: Document,
      options: { runOnly: { type: "tag"; values: string[] }; resultTypes: string[] },
    ) => Promise<AxeResult>;
  };
};

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "../../../..");
const pnpmStore = path.join(repositoryRoot, "node_modules/.pnpm");

function axeSource(): string {
  const packageDirectory = readdirSync(pnpmStore)
    .filter((entry) => entry.startsWith("axe-core@"))
    .sort()
    .reverse()
    .map((entry) => path.join(pnpmStore, entry, "node_modules/axe-core/axe.min.js"))
    .find(existsSync);

  if (!packageDirectory) {
    throw new Error(
      "axe-core was not installed. Run the repository's frozen pnpm install before this suite.",
    );
  }
  return readFileSync(packageDirectory, "utf8");
}

const bundledAxe = axeSource();
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

const sessionByRole = {
  public: null,
  parent: "e2e-parent",
  student: "e2e-student",
  tutor: "e2e-tutor",
  administrator: "e2e-admin",
  superAdministrator: "e2e-super-admin",
} as const;

type AuditRole = keyof typeof sessionByRole;

interface AuditTarget {
  name: string;
  path: string;
  role: AuditRole;
  locale?: "en" | "hy";
}

const targets: AuditTarget[] = [
  { name: "public home", path: "/home", role: "public" },
  { name: "public safety", path: "/safety", role: "public" },
  { name: "public privacy", path: "/privacy", role: "public" },
  { name: "public terms", path: "/terms", role: "public" },
  { name: "public consultation form", path: "/consultation", role: "public" },
  { name: "Armenian public home", path: "/home", role: "public", locale: "hy" },
  { name: "parent dashboard", path: "/dashboard/parent", role: "parent" },
  { name: "family management", path: "/families", role: "parent" },
  { name: "parental consent", path: "/consent", role: "parent" },
  { name: "parent payments", path: "/payments", role: "parent" },
  { name: "student dashboard", path: "/dashboard/student", role: "student" },
  { name: "student assignments", path: "/assignments", role: "student" },
  { name: "tutor dashboard", path: "/dashboard/tutor", role: "tutor" },
  { name: "lesson scheduling", path: "/scheduling", role: "tutor" },
  { name: "monitored communication", path: "/communication", role: "tutor" },
  { name: "incident reporting", path: "/support", role: "parent" },
  { name: "admin security", path: "/admin/security", role: "superAdministrator" },
  { name: "admin safeguarding queue", path: "/admin/support", role: "administrator" },
];

const runtimeWarmups: Array<{ cookie: string; path: string }> = [
  { cookie: sessionByRole.tutor, path: "/api/academics/feedback/not-found" },
  { cookie: sessionByRole.administrator, path: "/api/admin/audit?limit=1" },
  { cookie: sessionByRole.student, path: "/api/assessments?limit=1" },
  { cookie: sessionByRole.student, path: "/api/assignments/not-found" },
  { cookie: sessionByRole.parent, path: "/api/communication/conversations?limit=1" },
  { cookie: sessionByRole.parent, path: "/api/consent/students/sprof_demo_1" },
  { cookie: sessionByRole.tutor, path: "/api/content/resources?limit=1" },
  { cookie: sessionByRole.parent, path: "/api/families/students/sprof_demo_1" },
  { cookie: sessionByRole.student, path: "/api/gamification/overview" },
  { cookie: sessionByRole.parent, path: "/api/matching/requests?limit=1" },
  { cookie: sessionByRole.parent, path: "/api/payments/invoices?limit=1" },
  { cookie: sessionByRole.tutor, path: "/api/payouts/earnings?limit=1" },
  { cookie: sessionByRole.student, path: "/api/projects/not-found" },
  { cookie: sessionByRole.administrator, path: "/api/reporting" },
  { cookie: sessionByRole.tutor, path: "/api/scheduling/lessons?limit=1" },
  { cookie: sessionByRole.parent, path: "/api/support/tickets?limit=1" },
  { cookie: sessionByRole.tutor, path: "/api/tutors/me" },
];

async function warmRuntime(request: APIRequestContext, pathName: string, cookie: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await request.get(pathName, {
      headers: { cookie: `session_id=${cookie}` },
    });
    await response.body();
    if (response.status() < 500) return;
  }
  throw new Error(`Runtime warmup remained unavailable: ${pathName}`);
}

async function useRole(context: BrowserContext, role: AuditRole, baseURL: string): Promise<void> {
  await context.clearCookies();
  const sessionId = sessionByRole[role];
  if (sessionId) {
    await context.addCookies([
      {
        name: "session_id",
        value: sessionId,
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }
  await context.addCookies([
    {
      name: "NEXT_LOCALE",
      value: "en",
      url: baseURL,
      sameSite: "Lax",
    },
  ]);
}

async function assertPageLoaded(page: Page, target: AuditTarget): Promise<void> {
  await page.setExtraHTTPHeaders({ "x-locale": target.locale ?? "en" });
  let response = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await page.goto(target.path, { waitUntil: "networkidle" });
    if ((response?.status() ?? 500) < 400 && (await page.locator("main").count()) > 0) break;
    await page.waitForTimeout(250);
  }
  expect(response, `${target.name} did not produce a main-document response`).not.toBeNull();
  expect(response?.status(), `${target.name} returned ${String(response?.status())}`).toBeLessThan(
    400,
  );
  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
}

async function violationsFor(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: bundledAxe });
  return page.evaluate(
    async ({ tags }) =>
      (
        await (window as unknown as AxeWindow).axe.run(document, {
          runOnly: { type: "tag", values: tags },
          resultTypes: ["violations"],
        })
      ).violations,
    { tags: wcagTags },
  );
}

function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 5)
        .map(
          (node) =>
            `  - ${node.target.join(" ")}\n    ${node.failureSummary ?? node.html.slice(0, 180)}`,
        )
        .join("\n");
      return `${violation.impact ?? "unknown"}: ${violation.id} — ${violation.help}\n${violation.helpUrl}\n${nodes}`;
    })
    .join("\n\n");
}

test.describe("WCAG 2.2 AA automated sweep", () => {
  test.beforeAll(async ({ request }) => {
    for (const warmup of runtimeWarmups) {
      await warmRuntime(request, warmup.path, warmup.cookie);
    }
  });

  for (const target of targets) {
    test(target.name, async ({ baseURL, context, page }) => {
      if (!baseURL) throw new Error("Playwright baseURL is required.");
      await useRole(context, target.role, baseURL);
      await assertPageLoaded(page, target);

      const violations = await violationsFor(page);
      expect(violations, formatViolations(violations)).toEqual([]);
    });
  }

  test("consultation form is keyboard reachable with a visible focus indicator", async ({
    baseURL,
    context,
    page,
  }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required.");
    await useRole(context, "public", baseURL);
    await assertPageLoaded(page, {
      name: "public consultation form",
      path: "/consultation",
      role: "public",
    });

    const focusStates: Array<{ boxShadow: string; outlineStyle: string; outlineWidth: string }> =
      [];
    for (let press = 0; press < 30; press += 1) {
      await page.keyboard.press("Tab");
      const active = page.locator(":focus");
      if ((await active.count()) === 0) continue;
      if ((await active.getAttribute("id")) === "lead-name") break;
      focusStates.push(
        await active.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            boxShadow: style.boxShadow,
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
          };
        }),
      );
    }

    await expect(page.locator("#lead-name")).toBeFocused();
    const focusedStyle = await page.locator("#lead-name").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        boxShadow: style.boxShadow,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    focusStates.push(focusedStyle);

    expect(
      focusStates.some(
        ({ boxShadow, outlineStyle, outlineWidth }) =>
          boxShadow !== "none" ||
          (outlineStyle !== "none" && outlineStyle !== "auto" && outlineWidth !== "0px") ||
          (outlineStyle === "auto" && outlineWidth !== "0px"),
      ),
      "Keyboard focus moved, but no sampled focus target exposed a visible outline or box shadow.",
    ).toBe(true);
  });

  test("core pages do not overflow at 200% equivalent narrow viewport", async ({
    baseURL,
    context,
    page,
  }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required.");
    await page.setViewportSize({ width: 640, height: 900 });
    await useRole(context, "parent", baseURL);

    await page.setExtraHTTPHeaders({ "x-locale": "en" });
    for (const pathName of ["/home", "/consultation", "/dashboard/parent"]) {
      await page.goto(pathName, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `${pathName} has ${String(overflow)}px horizontal overflow`,
      ).toBeLessThanOrEqual(1);
    }
  });
});

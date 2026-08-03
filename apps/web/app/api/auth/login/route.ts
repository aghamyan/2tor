import { createSession, login, type Role } from "@app/auth";
import { createDb, loginEvents, sessions } from "@app/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { webRedis } from "../../../../lib/current-session";
import { postLoginDestination } from "../../../../lib/post-login-destination";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(1_024),
  next: z
    .string()
    .trim()
    .refine((value) => value.startsWith("/") && !value.startsWith("//"))
    .optional(),
});

const roleByDatabaseKey: Record<string, Role | undefined> = {
  parent: "parent",
  student: "student",
  tutor: "tutor",
  finance: "finance",
  admin: "administrator",
  super_admin: "super_administrator",
};

let databaseSingleton: ReturnType<typeof createDb> | undefined;

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for login.");
  databaseSingleton ??= createDb(url);
  return databaseSingleton;
}

function requestIp(request: NextRequest): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Enter your account and password." } },
      { status: 400 },
    );
  }

  const db = database();
  const identifier = parsed.data.identifier.toLocaleLowerCase("en-US");
  const user = await db.query.users.findFirst({
    where: (table, { or, eq }) => or(eq(table.email, identifier), eq(table.username, identifier)),
  });

  const grants = user
    ? await db.query.userRoles.findMany({
        where: (table, { and, eq, isNull }) =>
          and(eq(table.userId, user.id), isNull(table.revokedAt)),
      })
    : [];
  const roleRows =
    grants.length > 0
      ? await db.query.roles.findMany({
          where: (table, { inArray }) =>
            inArray(
              table.id,
              grants.map((grant) => grant.roleId),
            ),
        })
      : [];
  const resolvedRoles = roleRows
    .map((role) => roleByDatabaseKey[role.key])
    .filter((role): role is Role => role !== undefined);
  const mfaEnabled = user
    ? Boolean(
        await db.query.mfaMethods.findFirst({
          where: (table, { and, eq }) => and(eq(table.userId, user.id), eq(table.status, "active")),
        }),
      )
    : false;

  const result = await login({
    user: user
      ? {
          userId: user.id,
          passwordHash: user.passwordHash ?? "",
          status: user.status,
          roles: resolvedRoles,
          mfaEnabled,
        }
      : null,
    password: parsed.data.password,
    mfaVerifiedThisAttempt: false,
  });

  const userAgent = request.headers.get("user-agent");
  const ipAddress = requestIp(request);
  await db.insert(loginEvents).values({
    userId: user?.id ?? null,
    emailAttempted: identifier,
    success: result.ok,
    failureReason: result.ok ? null : result.reason,
    ipAddress,
    userAgent,
  });

  if (!result.ok) {
    const status = result.reason === "invalid_credentials" ? 401 : 403;
    return NextResponse.json(
      { error: { code: result.reason.toUpperCase(), message: result.reason } },
      { status },
    );
  }

  const created = await createSession(webRedis(), {
    userId: result.userId,
    roles: result.roles,
    ipAddress,
    userAgent,
  });
  await db.insert(sessions).values({
    id: created.session.id,
    userId: result.userId,
    expiresAt: new Date(created.session.expiresAt),
    lastSeenAt: new Date(created.session.lastSeenAt),
    ipAddress,
    userAgent,
  });

  const response = NextResponse.json({
    data: { next: postLoginDestination(parsed.data.next, result.roles) },
  });
  response.cookies.set(created.cookie.name, created.cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: created.cookie.sameSite,
    path: created.cookie.path,
    maxAge: created.cookie.maxAge,
  });
  return response;
}

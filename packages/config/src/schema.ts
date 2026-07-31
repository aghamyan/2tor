import { z } from "zod";

const required = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .min(1, `${name} is required`);

const optional = z.string().trim().min(1).optional();

const requiredUrl = (name: string) => required(name).url(`${name} must be a valid URL`);

const emailEnvShape = {
  // Choose one email provider. SES needs all three values; Resend needs one.
  RESEND_API_KEY: optional,
  SES_ACCESS_KEY_ID: optional,
  SES_SECRET_ACCESS_KEY: optional,
  SES_REGION: optional,
};

const emailProviderSchema = z.object(emailEnvShape).superRefine((env, context) => {
  const sesKeys = ["SES_ACCESS_KEY_ID", "SES_SECRET_ACCESS_KEY", "SES_REGION"] as const;
  const hasAnySesValue = sesKeys.some((key) => env[key] !== undefined);

  if (env.RESEND_API_KEY !== undefined || hasAnySesValue) {
    for (const key of sesKeys) {
      if (hasAnySesValue && env[key] === undefined) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required when SES is configured`,
        });
      }
    }
    return;
  }

  context.addIssue({
    code: "custom",
    path: ["RESEND_API_KEY"],
    message:
      "Configure email with RESEND_API_KEY or SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY, and SES_REGION",
  });
});

/** Environment values that must remain on the server. */
export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"], {
      error: "NODE_ENV must be development, test, or production",
    }),
    DATABASE_URL: requiredUrl("DATABASE_URL"),
    REDIS_URL: requiredUrl("REDIS_URL"),

    S3_ENDPOINT: requiredUrl("S3_ENDPOINT"),
    S3_BUCKET: required("S3_BUCKET"),
    S3_ACCESS_KEY_ID: required("S3_ACCESS_KEY_ID"),
    S3_SECRET_ACCESS_KEY: required("S3_SECRET_ACCESS_KEY"),

    STRIPE_SECRET_KEY: required("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: required("STRIPE_WEBHOOK_SECRET"),

    ...emailEnvShape,

    WEB_PUSH_VAPID_PUBLIC_KEY: required("WEB_PUSH_VAPID_PUBLIC_KEY"),
    WEB_PUSH_VAPID_PRIVATE_KEY: required("WEB_PUSH_VAPID_PRIVATE_KEY"),

    SENTRY_DSN: requiredUrl("SENTRY_DSN"),

    ZOOM_ACCOUNT_ID: required("ZOOM_ACCOUNT_ID"),
    ZOOM_CLIENT_ID: required("ZOOM_CLIENT_ID"),
    ZOOM_CLIENT_SECRET: required("ZOOM_CLIENT_SECRET"),

    APP_URL: requiredUrl("APP_URL"),
    SESSION_SECRET: required("SESSION_SECRET").min(
      32,
      "SESSION_SECRET must be at least 32 characters",
    ),
    KMS_KEY_ID: required("KMS_KEY_ID"),
  })
  .and(emailProviderSchema);

/** Values that are explicitly safe for browser bundles. */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: required("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

type EnvIssue = {
  message: string;
  path: PropertyKey[];
};

/** Formats Zod issues as one startup-safe, actionable error message. */
export function formatEnvIssues(issues: readonly EnvIssue[]): string {
  const details = issues.map((issue) => {
    const key = issue.path.map(String).join(".") || "environment";
    return `  - ${key}: ${issue.message}`;
  });

  return ["Invalid environment configuration:", ...details].join("\n");
}

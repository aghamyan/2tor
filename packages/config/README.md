# `@app/config`

This package is the single environment-variable boundary for the application.
Application code must never read `process.env` directly.

## Imports

Use the client-safe entrypoint from browser components:

```ts
import { publicEnv } from "@app/config";
```

Use the server-only entrypoint in route handlers, server actions, workers, and
other Node.js modules:

```ts
import { assertServerOnly, serverEnv } from "@app/config/env";

assertServerOnly();
```

`serverEnv` is intentionally not exported by `@app/config`. Consequently,
attempting to import it from the client-safe package entrypoint is a TypeScript
error. The server entrypoint also throws if it is evaluated in a browser.

Importing `serverEnv` validates both server and public values immediately. A
bad configuration throws one aggregated `Invalid environment configuration`
error, so Node exits before the application starts.

## Variables

| Variable                             | Used by                                                  | Exposure |
| ------------------------------------ | -------------------------------------------------------- | -------- |
| `NODE_ENV`                           | runtime mode selection                                   | server   |
| `DATABASE_URL`                       | PostgreSQL client and migrations                         | server   |
| `REDIS_URL`                          | queue and cache clients                                  | server   |
| `S3_ENDPOINT`                        | S3/MinIO client endpoint                                 | server   |
| `S3_BUCKET`                          | upload storage bucket                                    | server   |
| `S3_ACCESS_KEY_ID`                   | S3/MinIO authentication                                  | server   |
| `S3_SECRET_ACCESS_KEY`               | S3/MinIO authentication                                  | server   |
| `STRIPE_SECRET_KEY`                  | Stripe server API                                        | server   |
| `STRIPE_WEBHOOK_SECRET`              | Stripe webhook signature verification                    | server   |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js in the browser                                 | public   |
| `RESEND_API_KEY`                     | Resend email delivery; use this **or** the SES set below | server   |
| `SES_ACCESS_KEY_ID`                  | Amazon SES credentials                                   | server   |
| `SES_SECRET_ACCESS_KEY`              | Amazon SES credentials                                   | server   |
| `SES_REGION`                         | Amazon SES region                                        | server   |
| `WEB_PUSH_VAPID_PUBLIC_KEY`          | browser push-subscription setup                          | server   |
| `WEB_PUSH_VAPID_PRIVATE_KEY`         | push-message signing                                     | server   |
| `SENTRY_DSN`                         | server-side error reporting                              | server   |
| `ZOOM_ACCOUNT_ID`                    | Zoom Server-to-Server OAuth                              | server   |
| `ZOOM_CLIENT_ID`                     | Zoom Server-to-Server OAuth                              | server   |
| `ZOOM_CLIENT_SECRET`                 | Zoom Server-to-Server OAuth                              | server   |
| `APP_URL`                            | canonical application URL and callback URLs              | server   |
| `SESSION_SECRET`                     | session signing/encryption                               | server   |
| `KMS_KEY_ID`                         | envelope encryption key selection                        | server   |

Email requires either `RESEND_API_KEY`, or all of `SES_ACCESS_KEY_ID`,
`SES_SECRET_ACCESS_KEY`, and `SES_REGION`. `SESSION_SECRET` must be at least
32 characters.

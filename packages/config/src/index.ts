import { publicEnvSchema, type PublicEnv } from "./schema";

/**
 * Browser-safe configuration. Every key must begin with NEXT_PUBLIC_ and is
 * intentionally listed explicitly so Next.js can replace it at build time.
 */
export const publicEnv: PublicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

export { publicEnvSchema, type PublicEnv } from "./schema";

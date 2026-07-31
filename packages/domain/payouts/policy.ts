export interface PayoutPolicyConfig {
  /**
   * Current policy is `false`: trial lessons do not create tutor earnings. This is deliberately
   * configurable because the product specification calls out tutor recruitment as a reason the
   * policy may change.
   */
  payTrialLessons: boolean;
}

export const DEFAULT_PAYOUT_POLICY: Readonly<PayoutPolicyConfig> = Object.freeze({
  payTrialLessons: false,
});

export function payoutPolicyFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): PayoutPolicyConfig {
  const configured = environment.PAYOUT_PAY_TRIAL_LESSONS?.trim().toLowerCase();
  return {
    payTrialLessons: configured === "1" || configured === "true" || configured === "yes",
  };
}

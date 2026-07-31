import { z } from "zod";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const moneyMinorSchema = z.number().int().nonnegative().safe();
const currencySchema = z.enum(["USD", "AMD"]);

export const lessonEarningEventSchema = z
  .object({
    lessonId: z.string().trim().min(1).max(100),
    tutorProfileId: z.string().trim().min(1).max(100),
    outcome: z.enum(["completed", "chargeable"]),
    isTrial: z.boolean(),
    earnedAt: z.coerce.date(),
    scheduledCompensationAmountMinor: moneyMinorSchema,
    compensationCurrency: currencySchema,
    earningPercentage: z.number().int().min(1).max(100),
    companyPriceAmountMinor: moneyMinorSchema.nullish(),
    companyPriceCurrency: currencySchema.nullish(),
  })
  .strict()
  .refine(
    (value) =>
      (value.companyPriceAmountMinor == null && value.companyPriceCurrency == null) ||
      (value.companyPriceAmountMinor != null && value.companyPriceCurrency != null),
    {
      message: "Company price amount and currency must be supplied together.",
      path: ["companyPriceAmountMinor"],
    },
  );

export const lessonEarningSourceFilterSchema = z
  .object({
    periodStart: dateOnlySchema,
    periodEnd: dateOnlySchema,
  })
  .strict();

export const createPayoutBatchInputSchema = z
  .object({
    periodStart: dateOnlySchema,
    periodEnd: dateOnlySchema,
    fx: z
      .object({
        baseCurrency: currencySchema,
        quoteCurrency: z.literal("AMD").default("AMD"),
        rate: z
          .string()
          .trim()
          .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/, "Expected a positive decimal FX rate")
          .refine((value) => Number(value) > 0, "FX rate must be greater than zero"),
        source: z.string().trim().min(2).max(200),
        conversionDate: dateOnlySchema,
      })
      .strict(),
  })
  .strict();

export const completePayoutBatchInputSchema = z
  .object({
    // Presence is enforced by the service as EVIDENCE_REQUIRED so API/UI callers receive the
    // domain-specific error instead of a generic validation failure.
    evidenceRef: z.string().trim().max(500),
    paidAt: z.coerce.date().default(() => new Date()),
  })
  .strict();

export type CreatePayoutBatchInput = z.input<typeof createPayoutBatchInputSchema>;
export type CompletePayoutBatchInput = z.input<typeof completePayoutBatchInputSchema>;

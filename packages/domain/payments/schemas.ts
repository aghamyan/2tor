import { z } from "zod";

const id = z.string().trim().min(1).max(128);
const moneyMinor = z.number().int().safe().positive();

export const idempotencyKeySchema = z.string().trim().min(8).max(255);

export const transactionListSchema = z
  .object({
    cursor: z.string().trim().min(1).max(128).nullable().default(null),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .strict();

export const invoiceListSchema = transactionListSchema;

export const prepareInvoicePaymentSchema = z
  .object({
    invoiceId: id,
  })
  .strict();

export const createPriceSchema = z
  .object({
    key: z.string().trim().min(3).max(100),
    subjectId: id.nullable(),
    lessonType: z.enum(["standard", "trial", "group"]),
    amountMinor: moneyMinor,
    currency: z.enum(["USD", "AMD"]),
    effectiveFrom: z.string().datetime(),
    effectiveTo: z.string().datetime().nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.effectiveTo === null || new Date(value.effectiveFrom) < new Date(value.effectiveTo),
    { path: ["effectiveTo"], message: "The price end must be after its start." },
  );

export const createRefundSchema = z
  .object({
    paymentTransactionId: id,
    amountMinor: moneyMinor,
    reason: z.string().trim().min(3).max(2_000),
  })
  .strict();

export const createDiscountSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .transform((value) => value.toUpperCase()),
    type: z.enum(["sibling", "referral", "promotional", "admin_manual"]),
    percentOffBasisPoints: z.number().int().min(1).max(10_000).nullable(),
    amountOffMinor: moneyMinor.nullable(),
    currency: z.enum(["USD", "AMD"]).nullable(),
    startsAt: z.string().datetime().nullable(),
    endsAt: z.string().datetime().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const configured =
      Number(value.percentOffBasisPoints !== null) + Number(value.amountOffMinor !== null);
    if (configured !== 1) {
      context.addIssue({
        code: "custom",
        path: ["percentOffBasisPoints"],
        message: "Provide exactly one percentage or fixed discount.",
      });
    }
    if (value.amountOffMinor !== null && value.currency === null) {
      context.addIssue({
        code: "custom",
        path: ["currency"],
        message: "Fixed discounts require a currency.",
      });
    }
    if (value.startsAt && value.endsAt && new Date(value.startsAt) >= new Date(value.endsAt)) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "The discount end must be after its start.",
      });
    }
  });

export const financialReportSchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    currency: z.enum(["USD", "AMD"]),
  })
  .strict()
  .refine((value) => new Date(value.from) < new Date(value.to), {
    path: ["to"],
    message: "The report end must be after its start.",
  });

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;
export type CreatePriceInput = z.infer<typeof createPriceSchema>;

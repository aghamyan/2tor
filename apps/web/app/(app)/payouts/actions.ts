"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PayoutError } from "../../../../../packages/domain/payouts/errors";
import {
  approveEarningEntries,
  createMonthlyPayoutBatch,
  markExternalPayoutComplete,
} from "../../../../../packages/domain/payouts/services";
import type { PayoutActionState } from "./action-state";
import { currentPayoutContext } from "./context";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function errorState(error: unknown): PayoutActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: "errors.invalid",
      fieldErrors: error.flatten().fieldErrors,
    };
  }
  if (error instanceof PayoutError) {
    const message: PayoutActionState["message"] =
      error.code === "UNAUTHENTICATED"
        ? "errors.unauthenticated"
        : error.code === "FORBIDDEN"
          ? "errors.forbidden"
          : error.code === "EMPTY_BATCH"
            ? "errors.emptyBatch"
            : error.code === "DUPLICATE_BATCH"
              ? "errors.duplicateBatch"
              : error.code === "FX_CURRENCY_MISMATCH"
                ? "errors.fxMismatch"
                : error.code === "EVIDENCE_REQUIRED"
                  ? "errors.evidenceRequired"
                  : error.status < 500
                    ? "errors.invalid"
                    : "errors.generic";
    return { status: "error", message, fieldErrors: {} };
  }
  return { status: "error", message: "errors.generic", fieldErrors: {} };
}

export async function approveEarningsAction(
  _previous: PayoutActionState,
  formData: FormData,
): Promise<PayoutActionState> {
  try {
    const context = await currentPayoutContext();
    const entryIds = formData
      .getAll("entryId")
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    await approveEarningEntries(context.database, context.actor, entryIds);
    revalidatePath("/payouts");
    return { status: "success", message: "earningsApproved", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function createPayoutBatchAction(
  _previous: PayoutActionState,
  formData: FormData,
): Promise<PayoutActionState> {
  try {
    const context = await currentPayoutContext();
    await createMonthlyPayoutBatch(context.database, context.actor, {
      periodStart: text(formData, "periodStart"),
      periodEnd: text(formData, "periodEnd"),
      fx: {
        baseCurrency: text(formData, "baseCurrency") as "USD" | "AMD",
        quoteCurrency: "AMD",
        rate: text(formData, "rate"),
        source: text(formData, "source"),
        conversionDate: text(formData, "conversionDate"),
      },
    });
    revalidatePath("/payouts");
    return { status: "success", message: "batchCreated", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

export async function completePayoutBatchAction(
  _previous: PayoutActionState,
  formData: FormData,
): Promise<PayoutActionState> {
  try {
    const context = await currentPayoutContext();
    await markExternalPayoutComplete(context.database, context.actor, text(formData, "batchId"), {
      evidenceRef: text(formData, "evidenceRef"),
      paidAt: new Date(),
    });
    revalidatePath("/payouts");
    return { status: "success", message: "batchCompleted", fieldErrors: {} };
  } catch (error: unknown) {
    return errorState(error);
  }
}

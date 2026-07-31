"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import styles from "./payments.module.css";

interface StripeElements {
  create(type: "payment"): { mount(selector: HTMLElement): void; unmount(): void };
}

interface StripeClient {
  elements(options: { clientSecret: string; appearance?: Record<string, unknown> }): StripeElements;
  confirmPayment(options: {
    elements: StripeElements;
    confirmParams: { return_url: string };
    redirect: "if_required";
  }): Promise<{ error?: { message?: string } }>;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeClient;
  }
}

let stripeScriptPromise: Promise<void> | undefined;

function loadStripeScript(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  stripeScriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.stripe.com/v3/"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("stripe_load_failed")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("stripe_load_failed")), {
      once: true,
    });
    document.head.append(script);
  });
  return stripeScriptPromise;
}

export function PaymentElementForm({
  invoiceId,
  publishableKey,
}: {
  invoiceId: string;
  publishableKey: string | null;
}) {
  const t = useTranslations("payments.checkout");
  const operationKey = useRef(crypto.randomUUID());
  const mountRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<StripeClient | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<{ unmount(): void } | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "paying" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientSecret || !publishableKey || !mountRef.current) return;
    let canceled = false;
    void loadStripeScript()
      .then(() => {
        if (canceled || !window.Stripe || !mountRef.current) return;
        const stripe = window.Stripe(publishableKey);
        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#2046d7",
              colorText: "#14213d",
              borderRadius: "8px",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            },
          },
        });
        const paymentElement = elements.create("payment");
        paymentElement.mount(mountRef.current);
        stripeRef.current = stripe;
        elementsRef.current = elements;
        paymentElementRef.current = paymentElement;
        setState("ready");
      })
      .catch(() => {
        if (!canceled) setError(t("errors.load"));
      });
    return () => {
      canceled = true;
      paymentElementRef.current?.unmount();
    };
  }, [clientSecret, publishableKey, t]);

  async function prepare() {
    if (!publishableKey) {
      setError(t("errors.unavailable"));
      return;
    }
    setState("loading");
    setError(null);
    try {
      const response = await fetch("/api/payments/intents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": operationKey.current,
        },
        body: JSON.stringify({ invoiceId }),
      });
      const payload = (await response.json()) as {
        data?: { clientSecret: string };
        error?: { message?: string };
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "prepare_failed");
      }
      setClientSecret(payload.data.clientSecret);
    } catch {
      setState("idle");
      setError(t("errors.prepare"));
    }
  }

  async function confirm() {
    if (!stripeRef.current || !elementsRef.current) return;
    setState("paying");
    setError(null);
    const result = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: `${window.location.origin}/payments` },
      redirect: "if_required",
    });
    if (result.error) {
      setState("ready");
      setError(result.error.message ?? t("errors.confirm"));
      return;
    }
    setState("done");
  }

  if (state === "idle") {
    return (
      <div>
        <button className={styles.payButton} type="button" onClick={() => void prepare()}>
          {t("open")}
        </button>
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.checkout}>
      <div ref={mountRef} aria-label={t("secureFields")} />
      {state === "loading" ? <p className={styles.formNote}>{t("loading")}</p> : null}
      {state === "done" ? (
        <p className={styles.successMessage} role="status">
          {t("authorized")}
        </p>
      ) : (
        <button
          className={styles.payButton}
          type="button"
          disabled={state !== "ready"}
          onClick={() => void confirm()}
        >
          {state === "paying" ? t("authorizing") : t("authorize")}
        </button>
      )}
      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.formNote}>{t("hosted")}</p>
    </div>
  );
}

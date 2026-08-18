"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import styles from "./login.module.css";

type LoginError = {
  error?: {
    code?: string;
  };
};

export function LoginForm({ nextPath }: { nextPath: string }) {
  const t = useTranslations("auth.login");
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [needsMfaCode, setNeedsMfaCode] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setErrorCode(null);

    try {
      const code = form.get("code");
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: form.get("identifier"),
          password: form.get("password"),
          code: typeof code === "string" && code.length > 0 ? code : undefined,
          next: nextPath,
        }),
      });
      const payload = (await response.json()) as LoginError & { data?: { next?: string } };
      if (!response.ok) {
        const code = payload.error?.code ?? "UNKNOWN";
        setErrorCode(code);
        if (code === "MFA_VERIFICATION_REQUIRED") setNeedsMfaCode(true);
        return;
      }
      window.location.assign(payload.data?.next ?? "/dashboard");
    } catch {
      setErrorCode("UNKNOWN");
    } finally {
      setBusy(false);
    }
  }

  const errorKey =
    errorCode === "ACCOUNT_SUSPENDED"
      ? "errors.suspended"
      : errorCode === "ACCOUNT_PENDING"
        ? "errors.pending"
        : errorCode === "ACCOUNT_DELETED"
          ? "errors.deleted"
          : errorCode === "MFA_SETUP_REQUIRED"
            ? "errors.mfaSetup"
            : errorCode === "MFA_VERIFICATION_REQUIRED"
              ? "errors.mfaRequired"
              : errorCode
                ? "errors.invalid"
                : null;

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <label>
        <span>{t("identifier")}</span>
        <input
          autoComplete="username"
          name="identifier"
          placeholder={t("identifierPlaceholder")}
          required
        />
      </label>
      <label>
        <span>{t("password")}</span>
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      {needsMfaCode ? (
        <label>
          <span>{t("code")}</span>
          <input
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            name="code"
            pattern="\d{6}"
            placeholder={t("codePlaceholder")}
            required
          />
        </label>
      ) : null}
      {errorKey ? (
        <p className={styles.error} role="alert">
          {t(errorKey)}
        </p>
      ) : null}
      <button disabled={busy} type="submit">
        {busy ? t("submitting") : t("submit")}
      </button>
      <p className={styles.privacy}>{t("privacy")}</p>
    </form>
  );
}

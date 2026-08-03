"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { dropdownItemClassName } from "../../app-shell/dropdown";
import { LogOutIcon } from "../../app-shell/icons";
import { broadcastLogout, onLogoutBroadcast } from "./broadcast";
import { decideLogoutClick } from "./click-decision";
import { closeAllConnections } from "./closable-connections";
import { ConfirmDialog } from "./confirm-dialog";
import { performClientLogout } from "./perform-client-logout";
import { hasUnsavedWork } from "./unsaved-work";
import styles from "./logout.module.css";

type Status = "idle" | "pending" | "error";

/** `/en/...` or `/hy/...` — the only two prefixes `proxy.ts` ever rewrites (see its `LOCALES`). */
function currentLocalePrefix(): string {
  const [, maybeLocale] = window.location.pathname.split("/");
  return maybeLocale === "hy" ? "/hy" : "/en";
}

/**
 * The button that actually ends the session. Requesting the locale-prefixed path (rather than
 * the bare `/logout`) matters beyond cosmetics: `proxy.ts` rewrites `/{locale}/logout` to the
 * internal `/logout` route and attaches the `x-locale` header the route handler reads to decide
 * where `/signed-out` should redirect to — hitting the bare path would still work (proxy.ts
 * redirects it to a locale-prefixed URL first, and `fetch` follows that redirect), just with an
 * extra round trip. The actual request/teardown/navigate flow lives in `perform-client-logout.ts`,
 * kept out of this component so it can be unit-tested without rendering JSX.
 */
export function LogoutButton({ logOutLabel }: { logOutLabel: string }) {
  const t = useTranslations("auth.logout");
  const [status, setStatus] = useState<Status>("idle");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(
    () =>
      onLogoutBroadcast(() => {
        window.location.assign(`${currentLocalePrefix()}/signed-out`);
      }),
    [],
  );

  async function runLogout() {
    setStatus("pending");
    const result = await performClientLogout({
      fetchImpl: (input, init) => fetch(input, init),
      closeAllConnections,
      broadcastLogout,
      navigate: (path) => window.location.assign(path),
      localePrefix: currentLocalePrefix,
    });
    if (!result.ok) setStatus("error");
  }

  function handleClick() {
    if (status === "pending") return;
    if (decideLogoutClick(hasUnsavedWork()) === "show_confirm_dialog") {
      setDialogOpen(true);
      return;
    }
    void runLogout();
  }

  function handleConfirm() {
    setDialogOpen(false);
    void runLogout();
  }

  const label = status === "pending" ? t("pending") : status === "error" ? t("error") : logOutLabel;

  return (
    <>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        disabled={status === "pending"}
        aria-live="polite"
        aria-atomic="true"
        onClick={handleClick}
        className={dropdownItemClassName(styles.menuItem)}
      >
        <LogOutIcon className="size-4" aria-hidden="true" />
        {label}
      </button>
      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={t("confirmTitle")}
        description={t("confirmDescription")}
        confirmLabel={t("confirmAction")}
        cancelLabel={t("cancelAction")}
        busy={status === "pending"}
        onConfirm={handleConfirm}
      />
    </>
  );
}

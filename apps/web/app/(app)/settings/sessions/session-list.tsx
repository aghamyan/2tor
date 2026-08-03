"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { revokeAllDevicesAction, revokeSessionAction } from "./actions";
import { initialSessionsActionState, type SessionsActionState } from "./action-state";
import styles from "./sessions.module.css";

export interface SessionRowViewModel {
  id: string;
  isCurrentDevice: boolean;
  /** Pre-formatted server-side (e.g. "Chrome · macOS", or a translated "Unknown device"). */
  deviceLabel: string;
  ipAddress: string | null;
  /** Pre-formatted server-side via `@app/i18n/formats`'s `formatDateTime`. */
  lastActiveDisplay: string;
}

function Feedback({ state }: { state: SessionsActionState }) {
  const t = useTranslations("auth.sessions");
  if (state.message === null) return null;
  return (
    <p
      className={`${styles.feedback} ${
        state.status === "error" ? styles.feedbackError : styles.feedbackSuccess
      }`}
      role={state.status === "error" ? "alert" : "status"}
      aria-live={state.status === "error" ? "assertive" : "polite"}
    >
      {t(state.message)}
    </p>
  );
}

function SessionRow({ session }: { session: SessionRowViewModel }) {
  const t = useTranslations("auth.sessions");
  const [state, action, pending] = useActionState(revokeSessionAction, initialSessionsActionState);

  return (
    <li className={styles.row}>
      <div className={styles.rowMeta}>
        <p className={styles.device}>{session.deviceLabel}</p>
        <p className={styles.detail}>
          {session.ipAddress ? `${session.ipAddress} · ` : ""}
          {t("lastActive", { when: session.lastActiveDisplay })}
        </p>
        <Feedback state={state} />
      </div>
      {session.isCurrentDevice ? (
        <span className={styles.badge}>{t("thisDevice")}</span>
      ) : (
        <form action={action}>
          <input type="hidden" name="sessionId" value={session.id} />
          <button className={styles.button} disabled={pending} type="submit">
            {pending ? t("revoking") : t("revoke")}
          </button>
        </form>
      )}
    </li>
  );
}

export function SessionList({ sessions }: { sessions: SessionRowViewModel[] }) {
  const t = useTranslations("auth.sessions");
  const [allState, allAction, allPending] = useActionState(
    revokeAllDevicesAction,
    initialSessionsActionState,
  );
  const hasOtherSessions = sessions.some((session) => !session.isCurrentDevice);

  return (
    <div>
      {hasOtherSessions ? (
        <div className={styles.topActions}>
          <form action={allAction}>
            <button
              className={`${styles.button} ${styles.buttonDanger}`}
              disabled={allPending}
              type="submit"
            >
              {allPending ? t("revokingAll") : t("revokeAll")}
            </button>
          </form>
        </div>
      ) : null}
      <Feedback state={allState} />
      {sessions.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <ul className={styles.list}>
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      )}
    </div>
  );
}

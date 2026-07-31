"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { recordConsentAction } from "../../app/(app)/consent/actions";
import { initialConsentActionState } from "../../app/(app)/consent/action-state";
import {
  SIGNED_FORM_ATTESTATION_PHRASE,
  type ConsentMethod,
} from "../../../../packages/domain/consent/consent-method";
import { CONSENT_METHOD_KEYS } from "../../../../packages/domain/consent/schemas";
import { ActionFeedback } from "./action-feedback";
import { ChildDataNotice } from "./child-data-notice";
import styles from "./consent.module.css";

/**
 * Only methods with a registered `ConsentMethod` implementation are selectable — see this
 * package's README on `defaultConsentMethodRegistry` for why the rest are placeholders pending
 * legal review. Kept as a plain set of keys (not importing the registry itself, which is
 * server-only) so this client component only needs the type, not the implementations.
 */
const AVAILABLE_METHODS: ReadonlySet<ConsentMethod["key"]> = new Set(["signed_form"]);

export function ConsentForm({
  studentProfileId,
  studentName,
}: {
  studentProfileId: string;
  studentName: string;
}) {
  const tNotice = useTranslations("consent.notice");
  const tForm = useTranslations("consent.form");
  const [state, formAction, pending] = useActionState(
    recordConsentAction,
    initialConsentActionState,
  );

  return (
    <section className={styles.panel} aria-labelledby="consent-notice-title">
      <h2 className={styles.sectionTitle} id="consent-notice-title">
        {tNotice("title")}
      </h2>
      <ChildDataNotice studentName={studentName} />

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="studentProfileId" value={studentProfileId} />

        <div className={styles.checkRow}>
          <input id="notice-acknowledged" name="noticeAcknowledged" type="checkbox" required />
          <label className={styles.label} htmlFor="notice-acknowledged">
            {tNotice("acknowledge")}
          </label>
        </div>

        <h2 className={styles.sectionTitle}>{tForm("title")}</h2>
        <p className={styles.sectionIntro}>{tForm("intro")}</p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="consent-method">
            {tForm("methodLabel")}
          </label>
          <select
            className={styles.select}
            defaultValue="signed_form"
            id="consent-method"
            name="method"
          >
            {CONSENT_METHOD_KEYS.map((key) => (
              <option key={key} disabled={!AVAILABLE_METHODS.has(key)} value={key}>
                {tForm(`methodOptions.${key}`)}
              </option>
            ))}
          </select>
          <p className={styles.hint}>{tForm("methodHint")}</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="typed-full-name">
            {tForm("typedFullNameLabel")}
          </label>
          <input className={styles.input} id="typed-full-name" name="typedFullName" required />
          <p className={styles.hint}>{tForm("typedFullNameHint")}</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="attestation-phrase">
            {tForm("attestationLabel")}
          </label>
          <p className={styles.attestationPhrase}>
            <strong>{tForm("attestationPhraseCaption")}:</strong> {SIGNED_FORM_ATTESTATION_PHRASE}
          </p>
          <input
            className={styles.input}
            id="attestation-phrase"
            name="attestationPhrase"
            required
          />
        </div>

        <div className={styles.formActions}>
          <button className={styles.button} disabled={pending} type="submit">
            {pending ? tForm("submitting") : tForm("submit")}
          </button>
        </div>
        <ActionFeedback state={state} />
      </form>
    </section>
  );
}

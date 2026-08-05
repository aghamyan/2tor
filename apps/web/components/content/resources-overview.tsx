"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./content.module.css";

interface ResourceListItem {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  type: "document" | "video" | "link" | "worksheet" | "interactive";
  tags: string[];
  links: { id: string; url: string; provider: "youtube" | "other"; title: string | null }[];
}

function messageFromResponse(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

export function ResourcesOverview({
  resources,
  subjects,
  canCreate,
}: {
  resources: ResourceListItem[];
  subjects: { id: string; name: string }[];
  canCreate: boolean;
}) {
  const t = useTranslations("content");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [reportError, setReportError] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);

  const subjectName = (subjectId: string | null) =>
    subjectId ? (subjects.find((subject) => subject.id === subjectId)?.name ?? null) : null;

  async function submitReport(resourceId: string) {
    if (!reportReason.trim()) return;
    setSendingReport(true);
    setReportError(null);
    try {
      const response = await fetch("/api/content/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceId, reason: reportReason.trim() }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) throw new Error(messageFromResponse(payload, t("errors.report")));
      setReportedIds((current) => new Set(current).add(resourceId));
      setReportingId(null);
      setReportReason("");
    } catch (caught) {
      setReportError(caught instanceof Error ? caught.message : t("errors.report"));
    } finally {
      setSendingReport(false);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.overviewHeader}>
        <p className={styles.eyebrow}>{t("overview.kicker")}</p>
        <h1>{t("overview.title")}</h1>
        <p className={styles.lede}>{t("overview.intro")}</p>
        {canCreate ? (
          <Link className={styles.secondaryButton} href="/content/new">
            {t("overview.actions.create")}
          </Link>
        ) : null}
      </header>

      <div className={styles.workflowGrid}>
        {(["video", "materials", "safety"] as const).map((key) => (
          <article className={styles.workflowCard} key={key}>
            <h2>{t(`overview.${key}.title`)}</h2>
            <p>{t(`overview.${key}.body`)}</p>
          </article>
        ))}
      </div>

      <div className={styles.notice}>
        <div className={styles.noticeMark} aria-hidden="true">
          i
        </div>
        <p>{t("overview.notice")}</p>
      </div>

      <section className={styles.resourceList} aria-labelledby="resource-library-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t("overview.library.kicker")}</p>
            <h2 id="resource-library-title">{t("overview.library.title")}</h2>
          </div>
          <span className={styles.count}>{resources.length}</span>
        </div>
        {resources.length === 0 ? (
          <p className={styles.empty}>{t("overview.library.empty")}</p>
        ) : (
          <ul>
            {resources.map((resource) => {
              const isOpen = openId === resource.id;
              const videoLink = resource.links.find((link) => link.provider === "youtube");
              const subject = subjectName(resource.subjectId);
              return (
                <li className={styles.resourceRow} key={resource.id}>
                  <button
                    className={styles.resourceLink}
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId((current) => (current === resource.id ? null : resource.id))}
                  >
                    <span className={styles.typeTag}>{t(`types.${resource.type}`)}</span>
                    <b>{resource.title}</b>
                    <span>{resource.description ?? t("overview.library.noDescription")}</span>
                  </button>
                  {isOpen ? (
                    <div className={styles.resourceDetails}>
                      {resource.description ? <p>{resource.description}</p> : null}
                      {subject ? (
                        <p className={styles.hint}>{t("overview.library.subject", { subject })}</p>
                      ) : null}
                      {resource.tags.length > 0 ? (
                        <div className={styles.tagRow}>
                          {resource.tags.map((tag) => (
                            <span className={styles.tag} key={tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {videoLink ? (
                        <iframe
                          className={styles.embed}
                          src={videoLink.url}
                          title={videoLink.title ?? resource.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : null}
                      <div className={styles.detailActions}>
                        {reportedIds.has(resource.id) ? (
                          <span className={styles.hint}>{t("overview.library.reported")}</span>
                        ) : reportingId === resource.id ? (
                          <div className={styles.reportForm}>
                            <input
                              onChange={(event) => setReportReason(event.target.value)}
                              placeholder={t("overview.library.reportPlaceholder")}
                              value={reportReason}
                            />
                            <button
                              className={styles.buttonSecondary}
                              disabled={sendingReport || !reportReason.trim()}
                              onClick={() => void submitReport(resource.id)}
                              type="button"
                            >
                              {sendingReport ? t("overview.library.reportSending") : t("overview.library.reportSubmit")}
                            </button>
                            <button
                              className={styles.buttonSecondary}
                              onClick={() => {
                                setReportingId(null);
                                setReportReason("");
                                setReportError(null);
                              }}
                              type="button"
                            >
                              {t("overview.library.reportCancel")}
                            </button>
                          </div>
                        ) : (
                          <button
                            className={styles.buttonSecondary}
                            onClick={() => setReportingId(resource.id)}
                            type="button"
                          >
                            {t("overview.library.report")}
                          </button>
                        )}
                      </div>
                      {reportError && reportingId === resource.id ? (
                        <p className={styles.inlineError} role="alert">
                          {reportError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

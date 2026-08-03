"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { TutorDocumentRecord, TutorDocumentType } from "../../../../packages/domain/tutors/models";
import { StatusBadge, type BadgeTone } from "./status-badge";
import styles from "./tutors.module.css";
import { latestDocumentByType } from "./document-helpers";

type UploadState = "idle" | "uploading" | "error";

const DOCUMENT_TYPES: TutorDocumentType[] = [
  "identity",
  "education",
  "certification",
  "background_check",
  "other",
];
const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;

function statusTone(status: TutorDocumentRecord["status"] | "missing"): BadgeTone {
  if (status === "approved") return "mint";
  if (status === "pending") return "amber";
  if (status === "rejected") return "coral";
  return "neutral";
}

export function VerificationDocuments({
  documents,
  disabled,
}: {
  documents: TutorDocumentRecord[];
  disabled?: boolean;
}) {
  const t = useTranslations("tutors.documents");
  const router = useRouter();
  const [activeType, setActiveType] = useState<TutorDocumentType | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function upload(type: TutorDocumentType, file: File) {
    if (!ACCEPTED_MIME.includes(file.type)) {
      setUploadState("error");
      setUploadError(t("invalidType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadState("error");
      setUploadError(t("tooLarge"));
      return;
    }
    setUploadState("uploading");
    setUploadError(null);
    const body = new FormData();
    body.set("type", type);
    body.set("file", file);
    const response = await fetch("/api/tutors/me/documents", { method: "POST", body });
    if (!response.ok) {
      setUploadState("error");
      const responseBody = await response.json().catch(() => null);
      setUploadError(responseBody?.error?.message ?? t("uploadError"));
      return;
    }
    setUploadState("idle");
    setActiveType(null);
    router.refresh();
  }

  return (
    <div className={styles.card} id="verification-documents" aria-labelledby="documents-heading">
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle} id="documents-heading">
            {t("title")}
          </h2>
          <p className={styles.cardDescription}>{t("description")}</p>
        </div>
      </div>

      {disabled ? (
        <div className={styles.emptyState}>
          <h3>{t("lockedTitle")}</h3>
          <p>{t("lockedBody")}</p>
        </div>
      ) : (
        <div className={styles.rowList}>
          {DOCUMENT_TYPES.map((type) => {
            const document = latestDocumentByType(documents, type);
            const status = document?.status ?? "missing";
            return (
              <div className={styles.docRow} key={type}>
                <div className={styles.docMeta}>
                  <strong>{t(`type.${type}`)}</strong>
                  {document ? (
                    <span>
                      {t("submitted", {
                        date: new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                          document.uploadedAt,
                        ),
                      })}
                    </span>
                  ) : (
                    <span>{t("statusMissing")}</span>
                  )}
                  {document?.status === "rejected" && document.notes ? (
                    <p className={styles.docNote}>{document.notes}</p>
                  ) : null}
                </div>
                <div className={styles.docActions}>
                  <StatusBadge
                    tone={statusTone(status)}
                    label={t(status === "missing" ? "statusMissing" : `status.${status}`)}
                  />
                  <button
                    className={styles.buttonSecondary}
                    type="button"
                    onClick={() => {
                      setActiveType(activeType === type ? null : type);
                      setUploadState("idle");
                      setUploadError(null);
                    }}
                  >
                    {document ? t("replace") : t("upload")}
                  </button>
                </div>

                {activeType === type ? (
                  <div
                    className={styles.dropzone}
                    data-active={dragActive}
                    role="button"
                    tabIndex={0}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      const file = event.dataTransfer.files[0];
                      if (file) void upload(type, file);
                    }}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept={ACCEPTED_MIME.join(",")}
                      className={styles.srOnly}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) void upload(type, file);
                        event.currentTarget.value = "";
                      }}
                    />
                    <span>{uploadState === "uploading" ? t("uploading") : t("dropzoneLabel")}</span>
                    <span className={styles.dropzoneHint}>{t("formatsHint")}</span>
                    {uploadState === "error" ? (
                      <p className={styles.docNote}>{uploadError}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

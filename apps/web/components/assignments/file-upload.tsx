"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { SubmissionFileRecord } from "../../../../packages/domain/assignments/models";
import { requestSubmissionFileDownloadUrlAction } from "../../app/(app)/assignments/actions";
import styles from "./assignments.module.css";

function scanBadgeClass(status: SubmissionFileRecord["virusScanStatus"]): string | undefined {
  if (status === "clean") return styles.badgeSuccess;
  if (status === "pending") return styles.badgeWarning;
  return styles.badgeDanger;
}

export function FileUpload({
  assignmentId,
  submissionId,
  files,
  canUpload,
  canDownload,
}: {
  assignmentId: string;
  submissionId: string;
  files: SubmissionFileRecord[];
  canUpload: boolean;
  canDownload: boolean;
}) {
  const t = useTranslations("assignments.detail.files");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setUploadError(null);
    const body = new FormData();
    body.set("file", file);
    startTransition(async () => {
      const response = await fetch(
        `/api/assignments/${assignmentId}/submissions/${submissionId}/files`,
        { method: "POST", body },
      );
      if (!response.ok) {
        setUploadError("uploadFailed");
        return;
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  async function handleDownload(fileId: string) {
    setDownloadError(null);
    setDownloadingId(fileId);
    const result = await requestSubmissionFileDownloadUrlAction(fileId);
    setDownloadingId(null);
    if ("url" in result) window.location.assign(result.url);
    else setDownloadError("downloadFailed");
  }

  return (
    <section className={styles.panel} aria-labelledby="files-title">
      <h2 className={styles.sectionTitle} id="files-title">
        {t("title")}
      </h2>
      <p className={styles.sectionIntro}>{t("intro")}</p>

      {files.length === 0 ? (
        <p className={styles.hint}>{t("empty")}</p>
      ) : (
        <ul className={styles.fileList}>
          {files.map((file) => (
            <li className={styles.fileRow} key={file.id}>
              <span className={styles.fileName}>{file.fileName}</span>
              <span className={`${styles.badge} ${scanBadgeClass(file.virusScanStatus)}`}>
                {t(`scanStatus.${file.virusScanStatus}`)}
              </span>
              {canDownload && file.virusScanStatus === "clean" ? (
                <button
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  type="button"
                  onClick={() => void handleDownload(file.id)}
                  disabled={downloadingId === file.id}
                >
                  {downloadingId === file.id ? t("preparingDownload") : t("download")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {downloadError ? (
        <p className={styles.fieldError} role="alert">
          {t(`errors.${downloadError}`)}
        </p>
      ) : null}

      {canUpload ? (
        <form className={styles.form} onSubmit={handleUpload}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="submission-file">
              {t("chooseFile")}
            </label>
            <input
              aria-describedby="submission-file-error"
              className={styles.input}
              id="submission-file"
              ref={inputRef}
              required
              type="file"
            />
            <p className={styles.hint}>{t("securityNote")}</p>
          </div>
          <p
            className={styles.fieldError}
            id="submission-file-error"
            role={uploadError ? "alert" : undefined}
          >
            {uploadError ? t(`errors.${uploadError}`) : null}
          </p>
          <button className={styles.button} disabled={pending} type="submit">
            {pending ? t("uploading") : t("upload")}
          </button>
        </form>
      ) : null}
    </section>
  );
}

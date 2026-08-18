import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";

import type { QuestionDetailAttachment } from "../../app/(app)/discussions/queries";
import { formatFileSize } from "./attachment-constants";
import styles from "./question-detail.module.css";

export async function AttachmentList({ attachments }: { attachments: QuestionDetailAttachment[] }) {
  if (attachments.length === 0) return null;
  const t = await getTranslations("discussions");

  return (
    <div className={styles.attachments}>
      <h2 className={styles.attachmentsHeading}>{t("detail.attachmentsHeading", { count: attachments.length })}</h2>
      <ul className={styles.attachmentGrid}>
        {attachments.map((attachment) => {
          const isImage = attachment.mimeType === "image/jpeg" || attachment.mimeType === "image/png";
          const isReady = attachment.virusScanStatus === "clean";
          return (
            <li key={attachment.id} className={styles.attachmentTile}>
              {isReady ? (
                <a href={attachment.downloadUrl} target="_blank" rel="noreferrer" className={styles.attachmentTileLink}>
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={attachment.downloadUrl} alt={attachment.fileName} className={styles.attachmentThumb} />
                  ) : (
                    <span className={styles.attachmentFileIcon}>
                      <FileText size={22} aria-hidden="true" />
                    </span>
                  )}
                  <span className={styles.attachmentTileName}>{attachment.fileName}</span>
                </a>
              ) : (
                <span className={styles.attachmentTilePending}>
                  <span className={styles.attachmentFileIcon} aria-hidden="true">
                    <FileText size={22} />
                  </span>
                  <span className={styles.attachmentTileName}>{attachment.fileName}</span>
                </span>
              )}
              <span className={styles.attachmentMeta}>
                {formatFileSize(attachment.sizeBytes)}
                {!isReady ? (
                  <span className={styles.attachmentScanBadge} data-scan={attachment.virusScanStatus}>
                    {t(`attachment.scan.${attachment.virusScanStatus}` as never)}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

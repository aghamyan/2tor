"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Paperclip } from "lucide-react";

import { uploadQuestionAttachmentAction } from "../../app/(app)/discussions/actions";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
  isAllowedAttachmentType,
} from "./attachment-constants";
import styles from "./ask-question.module.css";

export function AttachmentUploadForm({ questionId }: { questionId: string }) {
  const t = useTranslations("discussions");
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setIsUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        if (!isAllowedAttachmentType(file.type)) {
          setError(t("ask.attachmentInvalidType"));
          continue;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          setError(t("ask.attachmentTooLarge"));
          continue;
        }
        const fileFormData = new FormData();
        fileFormData.set("file", file);
        const result = await uploadQuestionAttachmentAction(questionId, fileFormData);
        if (result.status === "error") setError(t(`feedback.${result.message}` as never));
      }
      router.refresh();
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={styles.field}>
      <label className={styles.attachmentDropzone} data-disabled={isUploading ? "true" : undefined}>
        {isUploading ? (
          <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
        ) : (
          <Paperclip size={16} aria-hidden="true" />
        )}
        {isUploading ? t("ask.uploading") : t("ask.attachmentAdd")}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={`${ALLOWED_ATTACHMENT_EXTENSIONS},image/jpeg,image/png,application/pdf`}
          className={styles.srOnlyInput}
          onChange={(event) => handleFiles(event.target.files)}
          disabled={isUploading}
        />
      </label>
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}

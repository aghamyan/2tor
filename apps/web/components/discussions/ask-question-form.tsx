"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, Loader2, Paperclip, X } from "lucide-react";

import type { DiscussionAskScopeOptions } from "../../../../packages/domain/discussions/models";
import { askQuestionAction, uploadQuestionAttachmentAction } from "../../app/(app)/discussions/actions";
import { initialDiscussionActionState } from "../../app/(app)/discussions/action-state";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENTS_PER_QUESTION,
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
  isAllowedAttachmentType,
} from "./attachment-constants";
import { DiscussionActionFeedback } from "./discussion-action-feedback";
import { DiscussionMarkdown } from "./markdown";
import styles from "./ask-question.module.css";

const DRAFT_KEY = "mathoverflow:ask-draft:v1";
const AUTOSAVE_DELAY_MS = 600;
const MAX_TAGS = 5;

const TEMPLATES = [
  "concept_explanation",
  "homework_help",
  "check_my_solution",
  "alternative_method",
  "exam_preparation",
  "proof_review",
  "general_discussion",
] as const;

const VISIBILITY_OPTIONS = ["private_support", "group_shared", "tutors_only", "community"] as const;

interface AskDraft {
  questionType: string;
  scopeValue: string;
  title: string;
  body: string;
  whatTried: string;
  visibility: string;
  tags: string[];
}

function parseDraft(raw: string): AskDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AskDraft>;
    if (typeof parsed.title !== "string" || typeof parsed.body !== "string") return null;
    return {
      questionType:
        typeof parsed.questionType === "string" ? parsed.questionType : "general_discussion",
      scopeValue: typeof parsed.scopeValue === "string" ? parsed.scopeValue : "",
      title: parsed.title,
      body: parsed.body,
      whatTried: typeof parsed.whatTried === "string" ? parsed.whatTried : "",
      visibility: typeof parsed.visibility === "string" ? parsed.visibility : "private_support",
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function subscribeToDraftStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function getDraftStorageSnapshot(): string | null {
  try {
    return window.localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}
function getDraftServerSnapshot(): string | null {
  return null;
}

function scopeTypeOf(scopeValue: string): string {
  return scopeValue.split(":")[0] ?? "";
}

/** `group_shared` visibility requires a group scope — `createQuestionSchema` rejects the
 *  combination server-side with an untranslated message, so the form must never let it through. */
function clampVisibility(visibility: string, scopeValue: string): string {
  return visibility === "group_shared" && scopeTypeOf(scopeValue) !== "group"
    ? "private_support"
    : visibility;
}

function firstScopeValue(scopeOptions: DiscussionAskScopeOptions): string {
  const course = scopeOptions.courses.find((c) => !c.isGroup);
  if (course) return `course:${course.id}`;
  const group = scopeOptions.courses.find((c) => c.isGroup);
  if (group) return `group:${group.id}`;
  const subject = scopeOptions.subjects[0];
  if (subject) return `subject:${subject.id}`;
  return "";
}

export function AskQuestionForm({ scopeOptions }: { scopeOptions: DiscussionAskScopeOptions }) {
  const t = useTranslations("discussions");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    askQuestionAction,
    initialDiscussionActionState,
  );

  const [questionType, setQuestionType] = useState<string>("general_discussion");
  const [scopeValue, setScopeValue] = useState<string>(() => firstScopeValue(scopeOptions));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [whatTried, setWhatTried] = useState("");
  const [visibility, setVisibility] = useState<string>("private_support");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [bodyMode, setBodyMode] = useState<"write" | "preview">("write");
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(null);

  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<{ index: number; total: number } | null>(null);
  const handledSlugRef = useRef<string | null>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    setAttachmentError(null);
    const next = [...stagedFiles];
    for (const file of Array.from(fileList)) {
      if (next.length >= MAX_ATTACHMENTS_PER_QUESTION) {
        setAttachmentError(t("ask.attachmentLimitReached", { count: MAX_ATTACHMENTS_PER_QUESTION }));
        break;
      }
      if (!isAllowedAttachmentType(file.type)) {
        setAttachmentError(t("ask.attachmentInvalidType"));
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachmentError(t("ask.attachmentTooLarge"));
        continue;
      }
      if (next.some((existing) => existing.name === file.name && existing.size === file.size)) continue;
      next.push(file);
    }
    setStagedFiles(next);
  }

  function removeStagedFile(index: number) {
    setStagedFiles((current) => current.filter((_, i) => i !== index));
  }

  useEffect(() => {
    if (state.status !== "success" || !state.slug || !state.questionId) return;
    if (handledSlugRef.current === state.slug) return;
    handledSlugRef.current = state.slug;
    const { slug, questionId } = state;

    if (stagedFiles.length === 0) {
      router.push(`/discussions/${slug}`);
      return;
    }

    let cancelled = false;
    (async () => {
      for (let index = 0; index < stagedFiles.length; index += 1) {
        if (cancelled) return;
        const file = stagedFiles[index];
        if (!file) continue;
        setUploadState({ index: index + 1, total: stagedFiles.length });
        const fileFormData = new FormData();
        fileFormData.set("file", file);
        // Best-effort: a single failed attachment shouldn't strand the question that already
        // posted successfully — the detail page offers the same uploader to retry. Still surface
        // failures to the console so they're not entirely invisible.
        const result = await uploadQuestionAttachmentAction(questionId, fileFormData).catch(
          (error: unknown) => ({ status: "error" as const, message: "errors.generic" as const, fieldErrors: {}, error }),
        );
        if (result.status === "error") console.warn(`Attachment upload failed for "${file.name}":`, result);
      }
      if (!cancelled) router.push(`/discussions/${slug}`);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // `getServerSnapshot` (null) keeps the very first client render identical to the server's, so
  // hydration never mismatches; React re-checks `getSnapshot` right after hydration completes and
  // triggers an ordinary post-mount update when it differs — the same timing an effect would give,
  // through the primitive React provides specifically for reading browser-only storage safely.
  const persistedDraftRaw = useSyncExternalStore(
    subscribeToDraftStorage,
    getDraftStorageSnapshot,
    getDraftServerSnapshot,
  );
  const [appliedDraftRaw, setAppliedDraftRaw] = useState<string | null>(null);
  if (persistedDraftRaw !== null && persistedDraftRaw !== appliedDraftRaw) {
    setAppliedDraftRaw(persistedDraftRaw);
    const draft = parseDraft(persistedDraftRaw);
    if (draft && (draft.title || draft.body)) {
      const restoredScopeValue = draft.scopeValue || firstScopeValue(scopeOptions);
      setQuestionType(draft.questionType);
      setScopeValue(restoredScopeValue);
      setTitle(draft.title);
      setBody(draft.body);
      setWhatTried(draft.whatTried);
      setVisibility(clampVisibility(draft.visibility, restoredScopeValue));
      setTags(draft.tags.slice(0, MAX_TAGS));
      setRestoredDraftAt(new Date().toISOString());
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      const draft: AskDraft = {
        questionType,
        scopeValue,
        title,
        body,
        whatTried,
        visibility,
        tags,
      };
      try {
        if (!title && !body) window.localStorage.removeItem(DRAFT_KEY);
        else window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Storage can be unavailable (private browsing quota, etc.) — autosave is a convenience, not a guarantee.
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [questionType, scopeValue, title, body, whatTried, visibility, tags]);

  const [scopeType, scopeId] = useMemo(() => {
    const [type, ...rest] = scopeValue.split(":");
    return [type ?? "", rest.join(":")];
  }, [scopeValue]);

  const hasScopeOptions = scopeOptions.courses.length > 0 || scopeOptions.subjects.length > 0;
  const requiresWhatTried = questionType === "homework_help";

  function addTag() {
    const value = tagDraft.trim().replace(/,+$/, "");
    if (!value || tags.includes(value) || tags.length >= MAX_TAGS) {
      setTagDraft("");
      return;
    }
    setTags([...tags, value]);
    setTagDraft("");
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // best-effort
    }
    setQuestionType("general_discussion");
    setScopeValue(firstScopeValue(scopeOptions));
    setTitle("");
    setBody("");
    setWhatTried("");
    setVisibility("private_support");
    setTags([]);
    setRestoredDraftAt(null);
  }

  if (!hasScopeOptions) {
    return (
      <div className={styles.emptyScope}>
        <p>{t("ask.noScopeOptions")}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={styles.form}
      onSubmit={() => {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          // best-effort
        }
      }}
    >
      {restoredDraftAt ? (
        <p className={styles.draftNotice}>
          <span>{t("ask.draftRestored")}</span>
          <button type="button" onClick={clearDraft}>
            {t("ask.discardDraft")}
          </button>
        </p>
      ) : null}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("ask.templateLabel")}</span>
        <div className={styles.templateGrid} role="radiogroup" aria-label={t("ask.templateLabel")}>
          {TEMPLATES.map((template) => (
            <button
              key={template}
              type="button"
              role="radio"
              aria-checked={questionType === template}
              data-selected={questionType === template ? "true" : undefined}
              className={styles.templateCard}
              onClick={() => setQuestionType(template)}
            >
              <span className={styles.templateTitle}>
                {t(`ask.templates.${template}.label` as never)}
              </span>
              <span className={styles.templateDescription}>
                {t(`ask.templates.${template}.description` as never)}
              </span>
            </button>
          ))}
        </div>
        <input type="hidden" name="questionType" value={questionType} />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="ask-scope">
          {t("ask.scopeLabel")}
        </label>
        <select
          id="ask-scope"
          className={styles.select}
          value={scopeValue}
          onChange={(event) => {
            const nextScopeValue = event.target.value;
            setScopeValue(nextScopeValue);
            setVisibility((current) => clampVisibility(current, nextScopeValue));
          }}
        >
          {scopeOptions.courses.filter((c) => !c.isGroup).length > 0 ? (
            <optgroup label={t("ask.scopeGroups.courses")}>
              {scopeOptions.courses
                .filter((c) => !c.isGroup)
                .map((course) => (
                  <option key={course.id} value={`course:${course.id}`}>
                    {course.title}
                  </option>
                ))}
            </optgroup>
          ) : null}
          {scopeOptions.courses.filter((c) => c.isGroup).length > 0 ? (
            <optgroup label={t("ask.scopeGroups.groups")}>
              {scopeOptions.courses
                .filter((c) => c.isGroup)
                .map((course) => (
                  <option key={course.id} value={`group:${course.id}`}>
                    {course.title}
                  </option>
                ))}
            </optgroup>
          ) : null}
          {scopeOptions.subjects.length > 0 ? (
            <optgroup label={t("ask.scopeGroups.subjects")}>
              {scopeOptions.subjects.map((subject) => (
                <option key={subject.id} value={`subject:${subject.id}`}>
                  {subject.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <input type="hidden" name="courseId" value={scopeType === "course" ? scopeId : ""} />
        <input type="hidden" name="groupId" value={scopeType === "group" ? scopeId : ""} />
        <input type="hidden" name="subjectId" value={scopeType === "subject" ? scopeId : ""} />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="ask-title">
          {t("ask.titleLabel")}
        </label>
        <span className={styles.fieldHint}>{t("ask.titleHint")}</span>
        <input
          id="ask-title"
          name="title"
          className={styles.input}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          minLength={12}
          maxLength={240}
          required
        />
        {state.fieldErrors.title?.[0] ? (
          <p className={styles.errorText}>{state.fieldErrors.title[0]}</p>
        ) : null}
      </div>

      <div className={styles.field}>
        <div className={styles.bodyTabs} role="tablist" aria-label={t("ask.bodyLabel")}>
          <button
            type="button"
            role="tab"
            aria-selected={bodyMode === "write"}
            className={styles.bodyTab}
            onClick={() => setBodyMode("write")}
          >
            {t("ask.writeTab")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={bodyMode === "preview"}
            className={styles.bodyTab}
            onClick={() => setBodyMode("preview")}
          >
            {t("ask.previewTab")}
          </button>
        </div>
        <label className={styles.fieldHint} htmlFor="ask-body">
          {t("ask.bodyHint")}
        </label>
        <textarea
          id="ask-body"
          name="body"
          className={bodyMode === "write" ? styles.textarea : styles.hiddenTextarea}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          aria-hidden={bodyMode !== "write"}
        />
        {bodyMode === "preview" ? (
          <div className={styles.previewBox}>
            {body.trim() ? (
              <DiscussionMarkdown body={body} />
            ) : (
              <p className={styles.previewEmpty}>{t("ask.previewEmpty")}</p>
            )}
          </div>
        ) : null}
        {state.fieldErrors.body?.[0] ? (
          <p className={styles.errorText}>{state.fieldErrors.body[0]}</p>
        ) : null}
      </div>

      {requiresWhatTried ? (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="ask-what-tried">
            {t("ask.whatTriedLabel")}
          </label>
          <textarea
            id="ask-what-tried"
            name="whatTried"
            className={styles.textarea}
            value={whatTried}
            onChange={(event) => setWhatTried(event.target.value)}
            required={requiresWhatTried}
          />
          {state.fieldErrors.whatTried?.[0] ? (
            <p className={styles.errorText}>{state.fieldErrors.whatTried[0]}</p>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="whatTried" value={whatTried} />
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("ask.visibilityLabel")}</span>
        <div
          className={styles.visibilityGrid}
          role="radiogroup"
          aria-label={t("ask.visibilityLabel")}
        >
          {VISIBILITY_OPTIONS.map((option) => {
            const disabled = option === "group_shared" && scopeType !== "group";
            return (
              <label
                key={option}
                className={styles.visibilityOption}
                data-selected={visibility === option ? "true" : undefined}
                data-disabled={disabled ? "true" : undefined}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={option}
                  checked={visibility === option}
                  disabled={disabled}
                  onChange={() => setVisibility(option)}
                />
                <span className={styles.visibilityCopy}>
                  <span className={styles.visibilityLabel}>
                    {t(`visibility.${option}` as never)}
                  </span>
                  <span className={styles.visibilityDescription}>
                    {disabled
                      ? t("ask.visibilityGroupSharedDisabled")
                      : t(`ask.visibilityDescriptions.${option}` as never)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {state.fieldErrors.groupId?.[0] ? (
          <p className={styles.errorText}>{state.fieldErrors.groupId[0]}</p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="ask-tags">
          {t("ask.tagsLabel")}
        </label>
        <div className={styles.tagInputRow}>
          {tags.map((tag) => (
            <span key={tag} className={styles.tagChip}>
              {tag}
              <button
                type="button"
                onClick={() => setTags(tags.filter((existing) => existing !== tag))}
                aria-label={t("ask.removeTag", { tag })}
              >
                ×
              </button>
              <input type="hidden" name="tags" value={tag} />
            </span>
          ))}
          {tags.length < MAX_TAGS ? (
            <input
              id="ask-tags"
              className={styles.tagInput}
              value={tagDraft}
              placeholder={t("ask.tagsPlaceholder")}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
            />
          ) : null}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("ask.attachmentsLabel")}</span>
        <span className={styles.fieldHint}>{t("ask.attachmentsHint")}</span>
        <label className={styles.attachmentDropzone}>
          <Paperclip size={16} aria-hidden="true" />
          {t("ask.attachmentAdd")}
          <input
            type="file"
            multiple
            accept={`${ALLOWED_ATTACHMENT_EXTENSIONS},image/jpeg,image/png,application/pdf`}
            className={styles.srOnlyInput}
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
            disabled={Boolean(uploadState)}
          />
        </label>
        {attachmentError ? <p className={styles.errorText}>{attachmentError}</p> : null}
        {stagedFiles.length > 0 ? (
          <ul className={styles.attachmentList}>
            {stagedFiles.map((file, index) => (
              <li key={`${file.name}-${file.size}-${index}`} className={styles.attachmentChip}>
                <FileText size={15} aria-hidden="true" />
                <span className={styles.attachmentName}>{file.name}</span>
                <span className={styles.attachmentSize}>{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeStagedFile(index)}
                  aria-label={t("ask.attachmentRemove", { name: file.name })}
                  disabled={Boolean(uploadState)}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <DiscussionActionFeedback state={state} />

      <div className={styles.submitRow}>
        <button type="submit" className={styles.submitButton} disabled={isPending || Boolean(uploadState)}>
          {uploadState ? (
            <>
              <Loader2 size={14} className={styles.spinner} aria-hidden="true" />
              {t("ask.uploadingAttachments", { index: uploadState.index, total: uploadState.total })}
            </>
          ) : isPending ? (
            t("ask.posting")
          ) : (
            t("ask.postButton")
          )}
        </button>
        <span className={styles.autosaveHint}>{t("ask.autosaveHint")}</span>
      </div>
    </form>
  );
}

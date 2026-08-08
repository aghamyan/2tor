"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./content.module.css";

type ResourceType = "video" | "link" | "document" | "worksheet" | "interactive";
type ResourceOwnership = "tutor_created" | "third_party_licensed" | "company";
type ResourceVisibility = "everyone" | "grades" | "students";

const RESOURCE_TYPES: ResourceType[] = ["video", "link", "document", "worksheet", "interactive"];
const OWNERSHIP_OPTIONS: ResourceOwnership[] = [
  "tutor_created",
  "third_party_licensed",
  "company",
];
const VISIBILITY_OPTIONS: ResourceVisibility[] = ["everyone", "grades", "students"];

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

export function NewResourceForm({
  subjects,
  students,
  gradeLevels,
}: {
  subjects: { id: string; name: string }[];
  students: { studentProfileId: string; studentName: string }[];
  gradeLevels: readonly string[];
}) {
  const t = useTranslations("content");
  const idPrefix = useId();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState<ResourceType>("video");
  const [ownership, setOwnership] = useState<ResourceOwnership>("third_party_licensed");
  const [tags, setTags] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoLinkTitle, setVideoLinkTitle] = useState("");
  const [visibility, setVisibility] = useState<ResourceVisibility>("everyone");
  const [selectedGradeLevels, setSelectedGradeLevels] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResourceId, setCreatedResourceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleGradeLevel(grade: string) {
    setSelectedGradeLevels((current) =>
      current.includes(grade) ? current.filter((g) => g !== grade) : [...current, grade],
    );
  }
  function toggleStudent(studentProfileId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentProfileId)
        ? current.filter((id) => id !== studentProfileId)
        : [...current, studentProfileId],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(t("newResource.validation.title"));
      return;
    }
    if ((type === "video" || type === "link") && !videoUrl.trim()) {
      setError(type === "video" ? t("newResource.validation.videoUrl") : t("newResource.validation.linkUrl"));
      return;
    }
    if (file && !rightsConfirmed) {
      setError(t("newResource.validation.rights"));
      return;
    }
    if (visibility === "grades" && selectedGradeLevels.length === 0) {
      setError(t("newResource.validation.gradeLevels"));
      return;
    }
    if (visibility === "students" && selectedStudentIds.length === 0) {
      setError(t("newResource.validation.students"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/content/resources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          subjectId: subjectId || null,
          type,
          ownership,
          status: publish ? "published" : "draft",
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          links:
            type === "video" || type === "link"
              ? [{ url: videoUrl.trim(), title: videoLinkTitle.trim() || null }]
              : [],
          visibility,
          gradeLevels: visibility === "grades" ? selectedGradeLevels : [],
          studentProfileIds: visibility === "students" ? selectedStudentIds : [],
        }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) throw new Error(messageFromResponse(payload, t("errors.create")));
      const resource = (payload as { data: { id: string } }).data;
      setCreatedResourceId(resource.id);

      if (file && rightsConfirmed) {
        const form = new FormData();
        form.set("file", file);
        form.set("resourceId", resource.id);
        form.set("rightsConfirmed", "true");
        const uploadResponse = await fetch("/api/content/uploads", { method: "POST", body: form });
        if (!uploadResponse.ok) {
          const uploadPayload = (await uploadResponse.json()) as unknown;
          throw new Error(messageFromResponse(uploadPayload, t("errors.upload")));
        }
      }
      router.push("/content");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.create"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.shell}>
      <Link className={styles.backLink} href="/content">
        ← {t("newResource.back")}
      </Link>
      <header className={styles.overviewHeader}>
        <p className={styles.eyebrow}>{t("newResource.eyebrow")}</p>
        <h1>{t("newResource.title")}</h1>
        <p className={styles.lede}>{t("newResource.intro")}</p>
      </header>

      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-title`}>
              {t("newResource.resourceTitle")}
            </label>
            <input
              className={styles.input}
              id={`${idPrefix}-title`}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-type`}>
              {t("newResource.type")}
            </label>
            <select
              className={styles.select}
              id={`${idPrefix}-type`}
              onChange={(event) => setType(event.target.value as ResourceType)}
              value={type}
            >
              {RESOURCE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {t(`types.${option}`)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-subject`}>
              {t("newResource.subject")}
            </label>
            <select
              className={styles.select}
              id={`${idPrefix}-subject`}
              onChange={(event) => setSubjectId(event.target.value)}
              value={subjectId}
            >
              <option value="">{t("newResource.selectSubject")}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            {subjects.length === 0 ? <p className={styles.hint}>{t("newResource.noSubjects")}</p> : null}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${idPrefix}-ownership`}>
              {t("newResource.ownership")}
            </label>
            <select
              className={styles.select}
              id={`${idPrefix}-ownership`}
              onChange={(event) => setOwnership(event.target.value as ResourceOwnership)}
              value={ownership}
            >
              {OWNERSHIP_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`newResource.ownershipOption.${option}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-description`}>
            {t("newResource.description")}
          </label>
          <textarea
            className={styles.textarea}
            id={`${idPrefix}-description`}
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-tags`}>
            {t("newResource.tags")}
          </label>
          <input
            className={styles.input}
            id={`${idPrefix}-tags`}
            onChange={(event) => setTags(event.target.value)}
            placeholder={t("newResource.tagsPlaceholder")}
            value={tags}
          />
          <p className={styles.hint}>{t("newResource.tagsHint")}</p>
        </div>

        {type === "video" || type === "link" ? (
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-video-url`}>
                {type === "video" ? t("newResource.videoUrl") : t("newResource.linkUrl")}
              </label>
              <input
                className={styles.input}
                id={`${idPrefix}-video-url`}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder={
                  type === "video" ? "https://www.youtube.com/watch?v=…" : "https://example.com/…"
                }
                value={videoUrl}
              />
              <p className={styles.hint}>
                {type === "video" ? t("newResource.videoUrlHint") : t("newResource.linkUrlHint")}
              </p>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${idPrefix}-video-link-title`}>
                {t("newResource.videoLinkTitle")}
              </label>
              <input
                className={styles.input}
                id={`${idPrefix}-video-link-title`}
                onChange={(event) => setVideoLinkTitle(event.target.value)}
                value={videoLinkTitle}
              />
            </div>
          </div>
        ) : (
          <div className={styles.uploadPanel}>
            <p className={styles.label}>{t("newResource.attachMaterial")}</p>
            <p className={styles.hint}>{t("newResource.attachMaterialHint")}</p>
            <input
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            {file ? (
              <label className={styles.checkboxRow}>
                <input
                  checked={rightsConfirmed}
                  onChange={(event) => setRightsConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>{t("newResource.rightsConfirm")}</span>
              </label>
            ) : null}
          </div>
        )}

        <div className={styles.field}>
          <p className={styles.label}>{t("newResource.visibility.label")}</p>
          <p className={styles.hint}>{t("newResource.visibility.hint")}</p>
          <div className={styles.visibilityOptions}>
            {VISIBILITY_OPTIONS.map((option) => (
              <label className={styles.radioRow} key={option}>
                <input
                  checked={visibility === option}
                  name={`${idPrefix}-visibility`}
                  onChange={() => setVisibility(option)}
                  type="radio"
                  value={option}
                />
                <span>
                  <b>{t(`newResource.visibility.option.${option}`)}</b>
                  <br />
                  {t(`newResource.visibility.optionHint.${option}`)}
                </span>
              </label>
            ))}
          </div>
          {visibility === "grades" ? (
            <div className={styles.chipGroup} role="group" aria-label={t("newResource.visibility.label")}>
              {gradeLevels.map((grade) => (
                <label className={styles.chip} key={grade} data-checked={selectedGradeLevels.includes(grade)}>
                  <input
                    checked={selectedGradeLevels.includes(grade)}
                    onChange={() => toggleGradeLevel(grade)}
                    type="checkbox"
                  />
                  {t("newResource.visibility.grade", { grade })}
                </label>
              ))}
            </div>
          ) : null}
          {visibility === "students" ? (
            students.length === 0 ? (
              <p className={styles.hint}>{t("newResource.visibility.noStudents")}</p>
            ) : (
              <div className={styles.chipGroup} role="group" aria-label={t("newResource.visibility.label")}>
                {students.map((option) => (
                  <label
                    className={styles.chip}
                    key={option.studentProfileId}
                    data-checked={selectedStudentIds.includes(option.studentProfileId)}
                  >
                    <input
                      checked={selectedStudentIds.includes(option.studentProfileId)}
                      onChange={() => toggleStudent(option.studentProfileId)}
                      type="checkbox"
                    />
                    {option.studentName}
                  </label>
                ))}
              </div>
            )
          ) : null}
        </div>

        <div className={styles.checkboxRow}>
          <input
            checked={publish}
            id={`${idPrefix}-publish`}
            onChange={(event) => setPublish(event.target.checked)}
            type="checkbox"
          />
          <label htmlFor={`${idPrefix}-publish`}>{t("newResource.publishNow")}</label>
        </div>
        <p className={styles.hint}>{t("newResource.publishHint")}</p>

        {error ? (
          <p className={styles.inlineError} role="alert">
            {error}
          </p>
        ) : null}
        {createdResourceId ? (
          <p className={styles.successPanel}>
            {t("newResource.resourceCreatedUploadFailed")}{" "}
            <Link href="/content">{t("newResource.back")}</Link>
          </p>
        ) : null}

        <button
          className={styles.primaryButton}
          disabled={submitting || createdResourceId !== null}
          type="submit"
        >
          {submitting ? t("newResource.posting") : t("newResource.post")}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";

import type { DiscussionTagRecord } from "../../../../packages/domain/discussions/models";
import { buildDiscussionsHref } from "./query-params";
import styles from "./feed.module.css";

const SORT_OPTIONS = [
  "recent_activity",
  "newest",
  "most_helpful",
  "most_answered",
  "unanswered",
  "highest_rated",
  "needs_tutor_review",
] as const;

/** Free text on the record, but a fixed vocabulary here keeps the filter usable — matches the
 *  values students actually enter on their enrollment profile (`gradeLevel`). */
const GRADE_OPTIONS = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "College",
] as const;
const STATUS_OPTIONS = [
  "open",
  "answered",
  "needs_tutor_review",
  "tutor_verified",
  "resolved",
] as const;

function submitOnChange(event: React.ChangeEvent<HTMLSelectElement>) {
  event.currentTarget.form?.requestSubmit();
}

export function FeedControls({
  basePath,
  tab,
  search,
  sort,
  tagSlug,
  grade,
  status,
  authorId,
  authorName,
  tags,
}: {
  basePath: string;
  tab: string | null;
  search: string;
  sort: string;
  tagSlug: string;
  grade: string;
  status: string;
  authorId?: string;
  authorName?: string;
  tags: DiscussionTagRecord[];
}) {
  const t = useTranslations("discussions");
  const currentParams = {
    tab: tab ?? undefined,
    search: search || undefined,
    sort: sort || undefined,
    tag: tagSlug || undefined,
    grade: grade || undefined,
    status: status || undefined,
    author: authorId,
    authorName,
  };
  const activeFilters: Array<{
    key: string;
    label: string;
    clear: Record<string, string | null>;
  }> = [];
  if (search) activeFilters.push({ key: "search", label: `“${search}”`, clear: { search: null } });
  if (tagSlug) {
    activeFilters.push({
      key: "tag",
      label: tags.find((tag) => tag.slug === tagSlug)?.name ?? tagSlug,
      clear: { tag: null },
    });
  }
  if (grade) {
    activeFilters.push({
      key: "grade",
      label: grade === "College" ? t("feed.gradeCollege") : t("feed.gradeOption", { grade }),
      clear: { grade: null },
    });
  }
  if (status) {
    activeFilters.push({
      key: "status",
      label: t(`status.${status}` as never),
      clear: { status: null },
    });
  }
  if (authorName) {
    activeFilters.push({
      key: "author",
      label: authorName,
      clear: { author: null, authorName: null },
    });
  }

  return (
    <div className={styles.filterRegion}>
      <form className={styles.controls} method="get" action={basePath}>
        {tab ? <input type="hidden" name="tab" value={tab} /> : null}
        {authorId ? <input type="hidden" name="author" value={authorId} /> : null}
        {authorName ? <input type="hidden" name="authorName" value={authorName} /> : null}
        <label className={styles.searchField}>
          <Search size={16} aria-hidden="true" />
          <span className={styles.srOnly}>{t("feed.searchLabel")}</span>
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder={t("feed.searchPlaceholder")}
          />
        </label>
        <div className={styles.filterIcon} aria-hidden="true">
          <SlidersHorizontal size={15} />
        </div>
        <label className={styles.selectField}>
          <span className={styles.srOnly}>{t("feed.sortLabel")}</span>
          <select
            name="sort"
            aria-label={t("feed.sortLabel")}
            defaultValue={sort}
            onChange={submitOnChange}
          >
            {SORT_OPTIONS.map((id) => (
              <option key={id} value={id}>
                {t(`feed.sort.${id}` as never)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.selectField}>
          <span className={styles.srOnly}>{t("feed.tagLabel")}</span>
          <select
            name="tag"
            aria-label={t("feed.tagLabel")}
            defaultValue={tagSlug}
            onChange={submitOnChange}
          >
            <option value="">{t("feed.allTags")}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.slug}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.selectField}>
          <span className={styles.srOnly}>{t("feed.gradeLabel")}</span>
          <select
            name="grade"
            aria-label={t("feed.gradeLabel")}
            defaultValue={grade}
            onChange={submitOnChange}
          >
            <option value="">{t("feed.allGrades")}</option>
            {GRADE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "College"
                  ? t("feed.gradeCollege")
                  : t("feed.gradeOption", { grade: option })}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.selectField}>
          <span className={styles.srOnly}>{t("feed.statusLabel")}</span>
          <select
            name="status"
            aria-label={t("feed.statusLabel")}
            defaultValue={status}
            onChange={submitOnChange}
          >
            <option value="">{t("feed.allStatuses")}</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`status.${option}` as never)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.srOnly}>
          {t("feed.searchLabel")}
        </button>
      </form>
      {activeFilters.length > 0 ? (
        <div className={styles.activeFilters} aria-label={t("feed.activeFiltersLabel")}>
          {activeFilters.map((filter) => (
            <Link
              key={filter.key}
              href={buildDiscussionsHref(basePath, currentParams, {
                ...filter.clear,
                cursor: null,
              })}
              className={styles.filterChip}
            >
              {filter.label}
              <X size={12} aria-hidden="true" />
            </Link>
          ))}
          <Link
            href={buildDiscussionsHref(basePath, currentParams, {
              search: null,
              tag: null,
              grade: null,
              status: null,
              author: null,
              authorName: null,
              cursor: null,
            })}
            className={styles.clearFilters}
          >
            <RotateCcw size={12} aria-hidden="true" />
            {t("feed.clearAll")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

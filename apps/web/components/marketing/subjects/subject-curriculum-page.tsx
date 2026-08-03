import { useTranslations } from "next-intl";
import { LeadForm } from "../lead-form";
import styles from "../marketing.module.css";
import { MathematicsPage } from "./mathematics-page";

export interface CurriculumModule {
  title: string;
  body: string;
}

/**
 * Slugs that get the curriculum + free-class treatment instead of `StandardPage`'s generic
 * single-paragraph body. Keyed to the `pages.<key>` i18n namespace the same way
 * `marketing-site.tsx`'s `pageKey` is, so content additions live in one place per subject.
 */
const SUBJECT_PAGE_KEY = {
  mathematics: "mathematics",
  "armenian-language-heritage": "armenianHeritage",
  sat: "sat",
  toefl: "toefl",
} as const;

export type SubjectCurriculumSlug = keyof typeof SUBJECT_PAGE_KEY;

export function isSubjectCurriculumSlug(slug: string): slug is SubjectCurriculumSlug {
  return slug in SUBJECT_PAGE_KEY;
}

export function SubjectCurriculumPage({ slug }: { slug: SubjectCurriculumSlug }) {
  if (slug === "mathematics") return <MathematicsPage />;

  return <StandardSubjectCurriculumPage slug={slug} />;
}

function StandardSubjectCurriculumPage({ slug }: { slug: Exclude<SubjectCurriculumSlug, "mathematics"> }) {
  const t = useTranslations("marketing");
  const key = SUBJECT_PAGE_KEY[slug];
  const modules = t.raw(`pages.${key}.modules`) as CurriculumModule[];
  const title = t(`pages.${key}.title`);

  return (
    <>
      <section className={styles.pageHero}>
        <p className={styles.eyebrow}>{t(`pages.${key}.eyebrow`)}</p>
        <h1 className={styles.pageHeading}>{title}</h1>
        <p className={styles.lede}>{t(`pages.${key}.description`)}</p>
      </section>
      <section className={styles.pageBody}>
        <div>
          <p className={styles.copy}>{t(`pages.${key}.body`)}</p>
          <div className={styles.audienceCallout}>
            <strong>{t(`pages.${key}.audienceLabel`)}</strong>
            <p>{t(`pages.${key}.audience`)}</p>
          </div>
          <h2 className={styles.curriculumHeading}>{t(`pages.${key}.curriculumHeading`)}</h2>
          <p className={styles.copy}>{t(`pages.${key}.curriculumIntro`)}</p>
          <ol className={styles.curriculumList}>
            {modules.map((module, index) => (
              <li className={styles.curriculumModule} key={module.title}>
                <span className={styles.curriculumModuleNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3>{module.title}</h3>
                  <p>{module.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className={styles.formShell} id="free-class">
            <h2 className={styles.curriculumHeading}>{t(`pages.${key}.ctaHeading`)}</h2>
            <p className={styles.copy}>{t(`pages.${key}.ctaBody`)}</p>
            <LeadForm kind="trial_class" defaultInterest={title} />
          </div>
        </div>
        <aside className={styles.aside}>
          <strong>{t("aside.title")}</strong>
          <p>{t("aside.body")}</p>
        </aside>
      </section>
    </>
  );
}

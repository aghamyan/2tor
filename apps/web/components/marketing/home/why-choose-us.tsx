import styles from "./home.module.css";

export interface WhyUsPoint {
  title: string;
  body: string;
}

export interface WhyChooseUsProps {
  eyebrow: string;
  title: string;
  description: string;
  points: readonly WhyUsPoint[];
}

export function WhyChooseUs({ eyebrow, title, description, points }: WhyChooseUsProps) {
  return (
    <section className={`${styles.section} ${styles.sectionMuted}`} aria-labelledby="why-us-title">
      <div className={styles.inner}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.sectionTitle} id="why-us-title">
            {title}
          </h2>
          <p className={styles.sectionLede}>{description}</p>
        </div>
        <div className={styles.whyGrid}>
          {points.map((point) => (
            <div className={styles.whyItem} key={point.title}>
              <h3 className={styles.whyItemTitle}>{point.title}</h3>
              <p className={styles.whyItemBody}>{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import styles from "./home.module.css";

export interface HowItWorksStep {
  title: string;
  body: string;
}

export interface HowItWorksProps {
  eyebrow: string;
  title: string;
  description: string;
  steps: readonly HowItWorksStep[];
}

/** A real, ordered sequence (a family's first month), so numbered steps genuinely earn their place. */
export function HowItWorks({ eyebrow, title, description, steps }: HowItWorksProps) {
  return (
    <section className={styles.section} aria-labelledby="how-it-works-title">
      <div className={styles.inner}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.sectionTitle} id="how-it-works-title">
            {title}
          </h2>
          <p className={styles.sectionLede}>{description}</p>
        </div>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li className={styles.step} key={step.title}>
              <div className={styles.stepTopline}>
                <span className={styles.stepNumber} aria-hidden="true">
                  0{index + 1}
                </span>
                <span className={styles.stepDot} aria-hidden="true" />
              </div>
              <div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

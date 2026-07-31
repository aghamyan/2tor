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
        <svg
          className={styles.stepTrail}
          viewBox="0 0 400 8"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1="4"
            x2="400"
            y2="4"
            stroke="hsl(var(--home-border))"
            strokeWidth="2"
            strokeDasharray="1 9"
            strokeLinecap="round"
          />
        </svg>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li className={styles.step} key={step.title}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

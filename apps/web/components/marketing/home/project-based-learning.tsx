import styles from "./home.module.css";

export interface ProjectCard {
  label: string;
  title: string;
  body: string;
  deliverables: readonly string[];
}

export interface ProjectBasedLearningProps {
  eyebrow: string;
  title: string;
  description: string;
  projects: readonly ProjectCard[];
}

export function ProjectBasedLearning({
  eyebrow,
  title,
  description,
  projects,
}: ProjectBasedLearningProps) {
  return (
    <section className={styles.section} aria-labelledby="projects-title">
      <div className={styles.inner}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.sectionTitle} id="projects-title">
            {title}
          </h2>
          <p className={styles.sectionLede}>{description}</p>
        </div>
        <div className={styles.projectsGrid}>
          {projects.map((project) => (
            <article className={styles.projectCard} key={project.title}>
              <p className={styles.projectLabel}>{project.label}</p>
              <h3 className={styles.projectTitle}>{project.title}</h3>
              <p className={styles.projectBody}>{project.body}</p>
              <ul className={styles.projectDeliverables}>
                {project.deliverables.map((deliverable) => (
                  <li key={deliverable}>{deliverable}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

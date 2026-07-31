import type { SafeHomeTestimonial } from "./content";
import styles from "./home.module.css";

export interface TestimonialsProps {
  eyebrow: string;
  title: string;
  disclosure: string;
  /**
   * Ship-time content is clearly-labeled placeholder/sample copy (see `apps/web/app/(marketing)/
   * home/page.tsx`'s render call). Real testimonials require written parental consent, must
   * reflect an actually-verified parent relationship, and must never be fabricated — the
   * `SafeHomeTestimonial` type this prop is built from makes an unverified, unconsented, or
   * student-identifying entry a compile error, not just a runtime check.
   */
  testimonials: readonly SafeHomeTestimonial[];
}

export function Testimonials({ eyebrow, title, disclosure, testimonials }: TestimonialsProps) {
  const publishable = testimonials.filter(
    (testimonial) =>
      testimonial.relationshipVerified &&
      testimonial.parentalConsent &&
      !testimonial.studentIdentifiable,
  );
  if (publishable.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="testimonials-title">
      <div className={styles.inner}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.sectionTitle} id="testimonials-title">
            {title}
          </h2>
        </div>
        <div className={styles.testimonialsGrid}>
          {publishable.map((testimonial) => (
            <figure className={styles.testimonialCard} key={testimonial.attribution}>
              <span className={styles.testimonialMark} aria-hidden="true">
                “
              </span>
              <blockquote className={styles.testimonialQuote}>{testimonial.quote}</blockquote>
              <figcaption className={styles.testimonialAttribution}>
                {testimonial.attribution}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className={styles.testimonialsDisclosure}>{disclosure}</p>
      </div>
    </section>
  );
}

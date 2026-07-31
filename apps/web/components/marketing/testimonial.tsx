import type { ReactNode } from "react";
import styles from "./marketing.module.css";

/** The type prevents publishing a testimonial without verification and parental consent. */
export interface SafeTestimonial {
  quote: string;
  attribution: string;
  relationshipVerified: true;
  parentalConsent: true;
  studentIdentifiable: false;
  childName?: never;
  childPhotoUrl?: never;
}

export function Testimonial({ value }: { value: SafeTestimonial }): ReactNode {
  if (!value.relationshipVerified || !value.parentalConsent || value.studentIdentifiable)
    return null;
  return (
    <figure className={styles.testimonial}>
      <blockquote>“{value.quote}”</blockquote>
      <figcaption>{value.attribution}</figcaption>
    </figure>
  );
}

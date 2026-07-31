"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./home.module.css";

/**
 * Progressive-enhancement entrance animation for below-the-fold sections. Only `transform`
 * animates (see `home.module.css`'s `.reveal`) — content is always fully opaque, readable, and
 * keyboard-focusable, with or without JavaScript, before or after the reveal fires. An
 * opacity-based reveal would make an unrevealed section's links focusable-but-invisible for a
 * keyboard user tabbing ahead of scroll, which is what this deliberately avoids.
 * `IntersectionObserver` is assumed present (universal in the evergreen browsers this app
 * targets); the one `setVisible` call lives inside its callback, an actual async subscription
 * rather than a synchronous effect-body call. Never wrap the hero in this — the LCP element must
 * paint immediately, with no JS dependency.
 */
export function ScrollReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${styles.reveal} ${visible ? styles.revealVisible : ""}`}>
      {children}
    </div>
  );
}

/** Guarantees full visibility when JavaScript is unavailable, regardless of `ScrollReveal` state. */
export function ScrollRevealNoScriptFallback() {
  return (
    <noscript>
      <style>{`.${styles.reveal}{opacity:1 !important;transform:none !important;}`}</style>
    </noscript>
  );
}

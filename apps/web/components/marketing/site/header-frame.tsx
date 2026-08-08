"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./site.module.css";

export function HeaderFrame({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div
      // Width is owned by `.headerFrame`, not a `max-w-*` utility: the scrolled state animates it
      // (full-bleed strip -> contracted pill), and a Tailwind class of equal specificity would
      // race it depending on stylesheet order.
      className={`${styles.headerFrame} mx-auto flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6`}
      data-scrolled={scrolled ? "true" : "false"}
    >
      {children}
    </div>
  );
}

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
      className={`${styles.headerFrame} mx-auto flex max-w-[88rem] items-center justify-between gap-3 px-4 py-2.5 sm:px-6`}
      data-scrolled={scrolled ? "true" : "false"}
    >
      {children}
    </div>
  );
}

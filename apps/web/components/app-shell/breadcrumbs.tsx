"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronRightIcon } from "./icons";
import { stripLocalePrefix } from "./nav-path";
import styles from "./app-shell.module.css";

function humanize(segment: string): string {
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Labels beyond the first path segment (a lesson id, a batch id, …) have no registry entry to
 * look up — each module owns that context and `(app)/<module>/**` is out of this task's file
 * scope to teach a per-route title. Humanizing the raw segment is a generic, always-correct
 * fallback; a module can opt into a real label later without a shell change.
 */
export function Breadcrumbs({
  ariaLabel,
  homeHref,
  homeLabel,
  labelByHref,
}: {
  ariaLabel: string;
  homeHref: string;
  homeLabel: string;
  labelByHref: Readonly<Record<string, string>>;
}) {
  const pathname = usePathname();
  const path = stripLocalePrefix(pathname);
  const segments = path.split("/").filter(Boolean);

  const crumbs: { href: string; label: string }[] = [{ href: homeHref, label: homeLabel }];
  let accumulated = "";
  for (const segment of segments) {
    accumulated += `/${segment}`;
    crumbs.push({ href: accumulated, label: labelByHref[accumulated] ?? humanize(segment) });
  }
  // Avoid a duplicate "Home" crumb when the current route's own segment resolves to `homeHref`
  // (e.g. `/dashboard`).
  const trail = crumbs.filter((crumb, index) => index === 0 || crumb.href !== homeHref);

  return (
    <nav
      aria-label={ariaLabel}
      className={`${styles.breadcrumbs} flex min-w-0 items-center gap-1.5 text-sm`}
    >
      <ol className="flex min-w-0 items-center gap-1.5">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
              ) : null}
              {isLast ? (
                <span aria-current="page" className={`${styles.breadcrumbCurrent} truncate`}>
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className={`${styles.breadcrumbLink} truncate`}>
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

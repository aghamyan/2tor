"use client";

import { SearchIcon } from "./icons";
import styles from "./app-shell.module.css";

/**
 * A real, labeled search input. The resource library is the current cross-learning search
 * surface, so submitting takes the query there instead of simulating a global index.
 */
export function SearchSlot({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <form role="search" action="/content" method="get" className={styles.searchSlot}>
      <label className={styles.visuallyHidden} htmlFor="app-shell-search">
        {label}
      </label>
      <div className={`${styles.searchForm} flex items-center gap-2 rounded-md px-3 py-1.5`}>
        <SearchIcon className={`${styles.searchIcon} size-4 shrink-0`} />
        <input
          id="app-shell-search"
          name="q"
          type="search"
          placeholder={placeholder}
          className={`${styles.searchInput} w-40 text-sm outline-none lg:w-64`}
        />
      </div>
    </form>
  );
}

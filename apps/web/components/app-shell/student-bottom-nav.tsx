"use client";

import Link from "next/link";
import { BookOpenCheck, CalendarDays, Home, MessageSquareText } from "lucide-react";
import { usePathname } from "next/navigation";

import { isActiveNavHref } from "./nav-path";
import styles from "./app-shell.module.css";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/scheduling", label: "Classes", icon: CalendarDays },
  { href: "/assignments", label: "Homework", icon: BookOpenCheck },
  { href: "/communication", label: "Messages", icon: MessageSquareText },
] as const;

export function StudentBottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.bottomNav} aria-label="Student shortcuts">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActiveNavHref(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            data-active={active}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

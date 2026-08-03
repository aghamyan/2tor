"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@app/ui";

import { LogoutButton } from "../auth/logout/logout-button";
import { ChevronDownIcon, SettingsIcon } from "./icons";
import { Dropdown, dropdownItemClassName } from "./dropdown";
import styles from "./app-shell.module.css";

/**
 * `/settings` has no page yet — out of this task's file scope (`(app)/*`), same follow-up noted
 * by `components/marketing/site/account-menu.tsx` for the exact same gap. The logout item is
 * `LogoutButton` (`components/auth/logout/logout-button.tsx`): a POST with CSRF protection to
 * `apps/web/app/(auth)/logout/route.ts`, not a plain `<a href>`/bare form.
 */
export function UserMenu({
  displayName,
  roleLabel,
  menuLabel,
  settingsLabel,
  logOutLabel,
}: {
  displayName: string;
  roleLabel: string;
  menuLabel: string;
  settingsLabel: string;
  logOutLabel: string;
}) {
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Dropdown
      align="end"
      triggerClassName={`${styles.userTrigger} flex items-center gap-2 rounded-full py-1 pl-1 pr-2`}
      triggerLabel={
        <>
          <Avatar className={`${styles.userAvatar} size-9`}>
            <AvatarFallback className={`${styles.avatarFallback} text-sm font-semibold`}>
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className={`${styles.userTriggerText} hidden xl:flex`}>
            <strong>{displayName}</strong>
            <small>{roleLabel}</small>
          </span>
          <span className={styles.visuallyHidden}>{menuLabel}</span>
          <ChevronDownIcon className="size-4" />
        </>
      }
    >
      <div role="presentation" className="px-3 py-2">
        <p className="truncate text-sm font-semibold">{displayName}</p>
        <span
          className={`${styles.roleBadge} mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold`}
        >
          {roleLabel}
        </span>
      </div>
      <div role="separator" className={`${styles.dropdownSeparator} my-1 h-px`} />
      <Link
        href="/settings/sessions"
        role="menuitem"
        tabIndex={-1}
        className={dropdownItemClassName("flex items-center gap-2")}
      >
        <SettingsIcon className="size-4" aria-hidden="true" />
        {settingsLabel}
      </Link>
      <LogoutButton logOutLabel={logOutLabel} />
    </Dropdown>
  );
}

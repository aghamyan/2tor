import { getTranslations } from "next-intl/server";
import type { Locale } from "@app/i18n/config";

import { NavRail } from "./nav-rail";
import { primaryNav } from "./nav-items";

/**
 * Thin server wrapper: it resolves the nav's `aria-label` on the server and hands the (serializable)
 * entry list to `NavRail`.
 *
 * `NavRail` is a client component because marking the current page needs `usePathname()`. That does
 * not cost the "links exist without JS" property this nav was written for — client components are
 * still server-rendered, so the anchors are in the initial HTML either way; only the sliding pill
 * and the dropdown's open/close need the client.
 */
export async function DesktopNav({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "marketing" });

  return <NavRail locale={locale} entries={primaryNav} ariaLabel={t("site.nav.ariaLabel")} />;
}

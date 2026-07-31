import { defaultLocale, resolveLocale } from "@app/i18n/config";
import { getMessages } from "@app/i18n/getMessages";
import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const requestHeaders = await headers();
  const locale = resolveLocale(requestHeaders.get("x-locale") ?? defaultLocale);

  return {
    locale,
    messages: await getMessages(locale),
    timeZone: "UTC",
  };
});

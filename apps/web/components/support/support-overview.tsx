"use client";

import { useTranslations } from "next-intl";

export function SupportOverview() {
  const t = useTranslations("support");
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          {t("overview.kicker")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{t("overview.title")}</h1>
        <p className="max-w-2xl text-slate-600">{t("overview.intro")}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {(["tickets", "lessonNow", "incidents"] as const).map((key) => (
          <section key={key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{t(`overview.${key}.title`)}</h2>
            <p className="mt-2 text-sm text-slate-600">{t(`overview.${key}.body`)}</p>
          </section>
        ))}
      </div>
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {t("overview.safety")}
      </p>
    </div>
  );
}

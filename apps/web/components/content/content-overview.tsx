"use client";
import { useTranslations } from "next-intl";
export function ContentOverview() {
  const t = useTranslations("content.overview");
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{t("kicker")}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-slate-600">{t("intro")}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {(["video", "materials", "safety"] as const).map((key) => (
          <section key={key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{t(`${key}.title`)}</h2>
            <p className="mt-2 text-sm text-slate-600">{t(`${key}.body`)}</p>
          </section>
        ))}
      </div>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {t("notice")}
      </p>
    </div>
  );
}

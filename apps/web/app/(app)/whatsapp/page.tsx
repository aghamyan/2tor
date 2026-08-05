import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { loadWhatsAppOverview } from "./queries";

export const dynamic = "force-dynamic";

export default async function WhatsAppOverviewPage() {
  const t = await getTranslations("whatsapp.overview");
  const { students } = await loadWhatsAppOverview();

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("description")}</p>
      </div>
      {students.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="divide-border divide-y rounded-md border">
          {students.map((student) => (
            <li key={student.studentProfileId}>
              <Link
                href={`/whatsapp/${student.studentProfileId}`}
                className="hover:bg-muted block px-4 py-3 text-sm font-medium"
              >
                {student.displayName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

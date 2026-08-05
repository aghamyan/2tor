import { getTranslations } from "next-intl/server";

import { WHATSAPP_REMINDER_LEAD_MINUTES_OPTIONS } from "../../../../../../packages/domain/whatsapp/schemas";
import { updateWhatsAppPreferencesAction, syncWhatsAppGroupAction } from "../actions";
import { loadWhatsAppGroupSettings } from "../queries";

export const dynamic = "force-dynamic";

export default async function WhatsAppGroupSettingsPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const t = await getTranslations("whatsapp.settings");
  const { studentDisplayName, group, members } = await loadWhatsAppGroupSettings(studentId);

  const reminderLeadMinutes = group?.reminderLeadMinutes ?? WHATSAPP_REMINDER_LEAD_MINUTES_OPTIONS[1];
  const status = group?.status ?? "not_provisioned";

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">{t("title", { studentName: studentDisplayName })}</h1>

      <form action={updateWhatsAppPreferencesAction} className="space-y-4 rounded-md border p-4">
        <input type="hidden" name="studentProfileId" value={studentId} />

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="isEnabled" defaultChecked={group?.isEnabled ?? false} />
          <span>
            <span className="block font-medium">{t("enableLabel")}</span>
            <span className="text-muted-foreground block">{t("enableHint")}</span>
          </span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t("leadTimeLabel")}</span>
          <select
            name="reminderLeadMinutes"
            defaultValue={reminderLeadMinutes}
            className="w-full rounded-md border px-3 py-2"
          >
            {WHATSAPP_REMINDER_LEAD_MINUTES_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {t(`leadTimeOptions.${minutes}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="includeChild" defaultChecked={group?.includeChild ?? false} />
          <span>
            <span className="block font-medium">{t("includeChildLabel")}</span>
            <span className="text-muted-foreground block">{t("includeChildHint")}</span>
          </span>
        </label>

        <button type="submit" className="rounded-md border px-4 py-2 text-sm font-medium">
          {t("save")}
        </button>
      </form>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="font-medium">{t("groupStatus.title")}</h2>
        <p className="text-sm">{t(`groupStatus.${status}`)}</p>

        <form action={syncWhatsAppGroupAction}>
          <input type="hidden" name="studentProfileId" value={studentId} />
          <button type="submit" className="rounded-md border px-4 py-2 text-sm font-medium">
            {t("syncButton")}
          </button>
        </form>

        <div>
          <h3 className="text-sm font-medium">{t("members.title")}</h3>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("members.empty")}</p>
          ) : (
            <ul className="mt-2 divide-y text-sm">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between py-2">
                  <span>{t(`members.role.${member.role}`)}</span>
                  <span className="text-muted-foreground">{t(`members.status.${member.status}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

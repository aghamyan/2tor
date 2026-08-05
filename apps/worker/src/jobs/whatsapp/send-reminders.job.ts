import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";
import { findLessonsNeedingWhatsAppReminder, markWhatsAppReminderSent } from "../../../../../packages/domain/whatsapp/reminders";
import { getWhatsAppDatabase, getWhatsAppProvider } from "./_client";

type Payload = Record<string, never>;

const schema = objectSchema<Payload>((value): value is Payload => isObject(value));

function leadTimeLabel(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${minutes} minutes`;
}

/**
 * Scans for lessons whose `whatsappGroups.reminderLeadMinutes`-configured lead time is now inside
 * the ±6-minute tolerance band around `now` (see `packages/domain/whatsapp/reminders.ts` for why
 * this can't reuse `scheduling.send-reminders`' fixed-window approach — the lead time is a
 * per-student column, not a repo-wide constant). Runs every 5 minutes, same cadence as its
 * scheduling counterpart.
 */
export default defineJob({
  name: "whatsapp.send-reminders",
  queue: "whatsapp",
  schema,
  async handler(_data, context) {
    const database = getWhatsAppDatabase();
    const provider = getWhatsAppProvider();

    const candidates = await findLessonsNeedingWhatsAppReminder(database);
    for (const candidate of candidates) {
      await provider.sendGroupTextMessage(
        candidate.providerGroupId,
        `Reminder: your lesson starts in about ${leadTimeLabel(candidate.reminderLeadMinutes)}.`,
      );
      await markWhatsAppReminderSent(database, candidate.lessonId);
    }
    context.log.info({ candidateCount: candidates.length }, "WhatsApp lesson reminders dispatched");
  },
  options: {
    repeat: { pattern: "*/5 * * * *" },
    repeatPayload: {},
  },
});

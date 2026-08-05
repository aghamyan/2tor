import { defineJob } from "../../job";
import { isObject, objectSchema } from "../notifications/_schema";
import { findLessonsNeedingClassEndedNotice, markWhatsAppClassEndedSent } from "../../../../../packages/domain/whatsapp/reminders";
import { getWhatsAppDatabase, getWhatsAppProvider } from "./_client";

type Payload = Record<string, never>;

const schema = objectSchema<Payload>((value): value is Payload => isObject(value));

function lessonLink(lessonId: string): string {
  // `APP_URL` — not `APP_BASE_URL`, which `scheduling/send-reminders.job.ts` reads despite
  // `packages/config/src/schema.ts` and `.env.example` both defining `APP_URL`. That's a
  // pre-existing bug in a different module (emits an unclickable relative path); not copied here
  // since a relative path in a WhatsApp message is dead on arrival.
  const base = process.env.APP_URL ?? "";
  return `${base}/scheduling/${lessonId}`;
}

/**
 * Fires once a lesson's `scheduledEndAt` passes, regardless of whether feedback has been
 * published yet — see packages/domain/whatsapp/README.md, "Class ended fires on a timer, not on
 * feedback publish," for why this doesn't gate on `lesson_feedback.status`. Unlike the reminder
 * scan, there's no upper time bound: a late "class ended" message is still correct, so this also
 * catches up after a worker outage instead of only looking at a narrow recent window.
 */
export default defineJob({
  name: "whatsapp.send-class-ended",
  queue: "whatsapp",
  schema,
  async handler(_data, context) {
    const database = getWhatsAppDatabase();
    const provider = getWhatsAppProvider();

    const candidates = await findLessonsNeedingClassEndedNotice(database);
    for (const candidate of candidates) {
      await provider.sendGroupTextMessage(
        candidate.providerGroupId,
        `Your class has ended. View your feedback and summary: ${lessonLink(candidate.lessonId)}`,
      );
      await markWhatsAppClassEndedSent(database, candidate.lessonId);
    }
    context.log.info({ candidateCount: candidates.length }, "WhatsApp class-ended notices dispatched");
  },
  options: {
    repeat: { pattern: "*/5 * * * *" },
    repeatPayload: {},
  },
});

import type { SupportPriority, SupportTicketRecord } from "./models";

/** Published support window in UTC until the operations module supplies regional calendars. */
export const DEFAULT_SUPPORT_HOURS = {
  startHourUtc: 9,
  endHourUtc: 21,
  businessDays: [1, 2, 3, 4, 5] as const,
};

function isBusinessDay(date: Date): boolean {
  return DEFAULT_SUPPORT_HOURS.businessDays.includes(date.getUTCDay() as 1 | 2 | 3 | 4 | 5);
}
function atHour(date: Date, hour: number): Date {
  const next = new Date(date);
  next.setUTCHours(hour, 0, 0, 0);
  return next;
}
function nextBusinessStart(date: Date): Date {
  const next = atHour(date, DEFAULT_SUPPORT_HOURS.startHourUtc);
  if (date.getTime() >= atHour(date, DEFAULT_SUPPORT_HOURS.endHourUtc).getTime())
    next.setUTCDate(next.getUTCDate() + 1);
  while (!isBusinessDay(next)) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/** Adds support-hours time, pausing outside support hours and at weekends. */
export function addSupportBusinessMinutes(createdAt: Date, minutes: number): Date {
  let cursor = new Date(createdAt);
  let remaining = minutes;
  while (remaining > 0) {
    if (
      !isBusinessDay(cursor) ||
      cursor < atHour(cursor, DEFAULT_SUPPORT_HOURS.startHourUtc) ||
      cursor >= atHour(cursor, DEFAULT_SUPPORT_HOURS.endHourUtc)
    )
      cursor = nextBusinessStart(cursor);
    const close = atHour(cursor, DEFAULT_SUPPORT_HOURS.endHourUtc);
    const available = Math.floor((close.getTime() - cursor.getTime()) / 60_000);
    if (available >= remaining) return new Date(cursor.getTime() + remaining * 60_000);
    remaining -= available;
    cursor = nextBusinessStart(close);
  }
  return cursor;
}

export function slaMinutes(priority: SupportPriority): number {
  return priority === "urgent" ? 15 : 12 * 60;
}
export function calculateSlaTarget(createdAt: Date, priority: SupportPriority): Date {
  return addSupportBusinessMinutes(createdAt, slaMinutes(priority));
}
export function isSlaBreached(ticket: SupportTicketRecord, now: Date): boolean {
  return (
    !["resolved", "closed"].includes(ticket.status) &&
    ticket.slaAlertedAt === null &&
    ticket.slaTargetAt.getTime() < now.getTime()
  );
}

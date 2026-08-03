"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { TutorAvailabilityRule } from "../../../../packages/domain/tutors/models";
import { localTimeToMinutes, minutesToLocalTime } from "../../../../packages/domain/tutors/availability";
import styles from "./tutors.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";
type TimeRange = { startMinute: number; endMinute: number };
type DayState = { available: boolean; ranges: TimeRange[] };
/** A `Record` over this exact literal union (not `number`) is a closed object type to the
 * compiler, so indexing it is statically safe under `noUncheckedIndexedAccess` — unlike a plain
 * `Record<number, DayState>`, which TypeScript treats as an open index signature. */
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type Week = Record<DayOfWeek, DayState>;

const DAY_ORDER: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]; // Monday first, Sunday last
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DEFAULT_RANGE: TimeRange = { startMinute: 9 * 60, endMinute: 17 * 60 };

function isDayOfWeek(value: number): value is DayOfWeek {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

function emptyWeek(): Week {
  return {
    0: { available: false, ranges: [] },
    1: { available: false, ranges: [] },
    2: { available: false, ranges: [] },
    3: { available: false, ranges: [] },
    4: { available: false, ranges: [] },
    5: { available: false, ranges: [] },
    6: { available: false, ranges: [] },
  };
}

function weekFromRules(rules: readonly TutorAvailabilityRule[]): Week {
  const week = emptyWeek();
  for (const rule of rules) {
    if (!isDayOfWeek(rule.dayOfWeek)) continue;
    const day = week[rule.dayOfWeek];
    day.available = true;
    day.ranges.push({ startMinute: rule.startMinute, endMinute: rule.endMinute });
  }
  for (const day of Object.values(week)) {
    day.ranges.sort((a, b) => a.startMinute - b.startMinute);
  }
  return week;
}

function zoneOffsetLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "shortOffset" }).formatToParts(
      new Date(),
    );
    return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function WeeklyAvailabilityEditor({
  timeZone,
  availability,
}: {
  timeZone: string;
  availability: TutorAvailabilityRule[];
}) {
  const t = useTranslations("tutors.availability");
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState<Week>(() => weekFromRules(availability));
  const offsetLabel = useMemo(() => zoneOffsetLabel(timeZone), [timeZone]);

  function setDay(day: DayOfWeek, updater: (current: DayState) => DayState) {
    setWeek((current) => ({ ...current, [day]: updater(current[day]) }));
  }

  function toggleAvailable(day: DayOfWeek) {
    setDay(day, (current) => ({
      available: !current.available,
      ranges: !current.available && current.ranges.length === 0 ? [DEFAULT_RANGE] : current.ranges,
    }));
  }

  function addRange(day: DayOfWeek) {
    setDay(day, (current) => ({ ...current, ranges: [...current.ranges, DEFAULT_RANGE] }));
  }

  function removeRange(day: DayOfWeek, index: number) {
    setDay(day, (current) => ({
      ...current,
      ranges: current.ranges.filter((_, rangeIndex) => rangeIndex !== index),
    }));
  }

  function updateRange(day: DayOfWeek, index: number, field: "startMinute" | "endMinute", value: string) {
    const minute = localTimeToMinutes(value);
    if (Number.isNaN(minute)) return;
    setDay(day, (current) => ({
      ...current,
      ranges: current.ranges.map((range, rangeIndex) =>
        rangeIndex === index ? { ...range, [field]: minute } : range,
      ),
    }));
  }

  function copyMondayToWeekdays() {
    const monday = week[1];
    setWeek((current) => ({
      ...current,
      2: { available: monday.available, ranges: [...monday.ranges] },
      3: { available: monday.available, ranges: [...monday.ranges] },
      4: { available: monday.available, ranges: [...monday.ranges] },
      5: { available: monday.available, ranges: [...monday.ranges] },
    }));
  }

  function clearWeek() {
    setWeek(emptyWeek());
  }

  async function save() {
    setState("saving");
    setError(null);
    const recurring = Object.entries(week).flatMap(([day, dayState]) =>
      dayState.available
        ? dayState.ranges
            .filter((range) => range.endMinute > range.startMinute)
            .map((range) => ({
              dayOfWeek: Number(day),
              startMinute: range.startMinute,
              endMinute: range.endMinute,
              effectiveFrom: null,
              effectiveTo: null,
            }))
        : [],
    );
    const response = await fetch("/api/tutors/me/availability", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timeZone, recurring }),
    });
    if (!response.ok) {
      setState("error");
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? t("saveError"));
      return;
    }
    setState("saved");
    router.refresh();
  }

  const hasAnyAvailability = Object.values(week).some(
    (day) => day.available && day.ranges.length > 0,
  );
  // `save()` silently filters out `endMinute <= startMinute` rows before sending them — if the
  // button stayed enabled, a tutor could fix one day, leave another broken, see "Saved.", and never
  // learn the broken row was dropped rather than stored.
  const hasInvalidRange = Object.values(week).some(
    (day) => day.available && day.ranges.some((range) => range.endMinute <= range.startMinute),
  );

  return (
    <div className={styles.card} id="weekly-availability" aria-labelledby="availability-heading">
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle} id="availability-heading">
            {t("title")}
          </h2>
          <p className={styles.cardDescription}>{t("description")}</p>
        </div>
      </div>

      <p className={styles.zoneRow}>
        {t("timeZoneLabel")} <strong>{timeZone} · {offsetLabel}</strong>
      </p>

      {!hasAnyAvailability ? (
        <div className={styles.emptyState}>
          <h3>{t("emptyTitle")}</h3>
          <p>{t("emptyBody")}</p>
        </div>
      ) : null}

      <div className={styles.weekGrid}>
        {DAY_ORDER.map((day) => {
          const dayState = week[day];
          return (
            <div className={styles.dayRow} data-available={dayState.available} key={day}>
              <div className={styles.dayHeader}>
                <span className={styles.dayName}>{t(`weekday.${WEEKDAYS[day]}`)}</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={dayState.available}
                    onChange={() => toggleAvailable(day)}
                  />
                  <span className={styles.switchTrack} aria-hidden="true" />
                  <span className={styles.switchLabel}>
                    {dayState.available ? t("available") : t("unavailable")}
                  </span>
                </label>
              </div>

              {dayState.available ? (
                <div className={styles.dayRanges}>
                  {dayState.ranges.map((range, index) => (
                    <div className={styles.rangeRow} key={index}>
                      <label>
                        <span className={styles.srOnly}>{t("startTime")}</span>
                        <input
                          type="time"
                          value={minutesToLocalTime(range.startMinute)}
                          onChange={(event) =>
                            updateRange(day, index, "startMinute", event.currentTarget.value)
                          }
                        />
                      </label>
                      <span className={styles.rangeSeparator} aria-hidden="true">
                        –
                      </span>
                      <label>
                        <span className={styles.srOnly}>{t("endTime")}</span>
                        <input
                          type="time"
                          value={minutesToLocalTime(range.endMinute)}
                          onChange={(event) =>
                            updateRange(day, index, "endMinute", event.currentTarget.value)
                          }
                        />
                      </label>
                      {range.endMinute <= range.startMinute ? (
                        <span className={styles.fieldError}>{t("rangeInvalid")}</span>
                      ) : null}
                      <button
                        className={`${styles.buttonGhost} ${styles.buttonDanger}`}
                        type="button"
                        onClick={() => removeRange(day, index)}
                      >
                        {t("removeTime")}
                      </button>
                    </div>
                  ))}
                  <button className={styles.buttonGhost} type="button" onClick={() => addRange(day)}>
                    {t("addTime")}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={styles.weekActions}>
        <button className={styles.buttonSecondary} type="button" onClick={copyMondayToWeekdays}>
          {t("copyMonday")}
        </button>
        <button className={styles.buttonSecondary} type="button" onClick={clearWeek}>
          {t("clearWeek")}
        </button>
      </div>

      {hasAnyAvailability ? (
        <>
          <h3 className={styles.subheading}>{t("previewTitle")}</h3>
          <div className={styles.previewList}>
            {DAY_ORDER.filter((day) => week[day].available && week[day].ranges.length > 0).map((day) => (
              <span key={day}>
                <strong>{t(`weekday.${WEEKDAYS[day]}`)}</strong>{" "}
                {week[day].ranges
                  .filter((range) => range.endMinute > range.startMinute)
                  .map((range) => `${minutesToLocalTime(range.startMinute)}–${minutesToLocalTime(range.endMinute)}`)
                  .join(", ")}
              </span>
            ))}
          </div>
        </>
      ) : null}

      <div className={styles.saveBar}>
        <span
          className={styles.saveStatus}
          data-tone={state === "saved" ? "success" : state === "error" ? "error" : undefined}
          aria-live="polite"
        >
          {state === "saving" && t("saving")}
          {state === "saved" && t("saved")}
          {state === "error" && (error ?? t("saveError"))}
          {state === "idle" && hasInvalidRange && t("fixInvalidRanges")}
        </span>
        <button
          className={styles.buttonPrimary}
          disabled={state === "saving" || hasInvalidRange}
          type="button"
          onClick={save}
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}

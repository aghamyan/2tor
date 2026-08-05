"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe2,
  GripVertical,
  List,
  MessageCircle,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Repeat2,
  Search,
  SlidersHorizontal,
  UserRoundCheck,
  Video,
  X,
} from "lucide-react";

import type { ClassListRecord } from "../../app/(app)/scheduling/queries";
import type {
  SchedulableAssignmentOption,
  SubjectOption,
} from "../../../../packages/domain/scheduling/models";
import { detectBrowserTimezone, getTimezoneOptions } from "./timezones";
import styles from "./tutor-classes-workspace.module.css";

type CalendarView = "day" | "week" | "month" | "agenda";
type WorkspaceView = "calendar" | "list";
type CalendarLesson = ClassListRecord & { scheduledStartAt: Date; scheduledEndAt: Date };
type UndoPair = { previous: CalendarLesson; current: CalendarLesson };

const HOUR_HEIGHT = 64;
const WEEK_STARTS_ON = 1;
const VIEW_STORAGE_KEY = "2tor-classes-workspace-view";
const CALENDAR_VIEW_STORAGE_KEY = "2tor-classes-calendar-view";
const subjectPalette = ["indigo", "teal", "violet", "amber", "coral"] as const;

function dateAtStartOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfWeek(value: Date) {
  const date = dateAtStartOfDay(value);
  const day = date.getDay();
  date.setDate(date.getDate() - ((day - WEEK_STARTS_ON + 7) % 7));
  return date;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(value);
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: number("year"),
    month: number("month"),
    day: number("day"),
    hour: number("hour"),
    minute: number("minute"),
  };
}

function dateInTimezone(value: Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function sameDayInTimezone(value: Date, calendarDay: Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  return (
    parts.year === calendarDay.getFullYear() &&
    parts.month === calendarDay.getMonth() + 1 &&
    parts.day === calendarDay.getDate()
  );
}

function dateKeyInTimezone(value: Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function wallTimeToUtc(day: Date, minutes: number, timeZone: string) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  let utc = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
  for (let index = 0; index < 2; index += 1) {
    const shown = zonedParts(new Date(utc), timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
    utc -= shownAsUtc - Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
  }
  return new Date(utc);
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function minutesFromMidnight(value: Date, timeZone?: string) {
  if (timeZone) {
    const parts = zonedParts(value, timeZone);
    return parts.hour * 60 + parts.minute;
  }
  return value.getHours() * 60 + value.getMinutes();
}

function minutesDuration(lesson: CalendarLesson) {
  return Math.max(
    15,
    Math.round((lesson.scheduledEndAt.getTime() - lesson.scheduledStartAt.getTime()) / 60_000),
  );
}

function formatTime(value: Date, timeZone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(value);
}

function subjectColor(subjectId: string) {
  let score = 0;
  for (const character of subjectId) score += character.charCodeAt(0);
  return subjectPalette[score % subjectPalette.length];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function MiniCalendar({ anchor, onSelect }: { anchor: Date; onSelect: (date: Date) => void }) {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const today = new Date();

  return (
    <section className={styles.miniCalendar} aria-label="Month picker">
      <header>
        <strong>
          {new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(anchor)}
        </strong>
        <div>
          <button type="button" aria-label="Previous month" onClick={() => onSelect(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>
            <ChevronLeft />
          </button>
          <button type="button" aria-label="Next month" onClick={() => onSelect(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>
            <ChevronRight />
          </button>
        </div>
      </header>
      <div className={styles.miniWeekdays} aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className={styles.miniDays}>
        {days.map((day) => (
          <button
            type="button"
            key={dateKey(day)}
            data-outside={day.getMonth() !== anchor.getMonth()}
            data-selected={sameDay(day, anchor)}
            data-today={sameDay(day, today)}
            onClick={() => onSelect(day)}
            aria-label={new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(day)}
          >
            {day.getDate()}
          </button>
        ))}
      </div>
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" className={styles.toggle} role="switch" aria-checked={checked} onClick={onChange}>
      <span /> {label}
    </button>
  );
}

function StatusPill({ status }: { status: CalendarLesson["status"] }) {
  return <span className={styles.statusPill} data-status={status}>{status.replaceAll("_", " ")}</span>;
}

function LessonPopover({
  lesson,
  studentName,
  subjectName,
  timezone,
  onClose,
}: {
  lesson: CalendarLesson;
  studentName: string;
  subjectName: string;
  timezone: string;
  onClose: () => void;
}) {
  return (
    <div className={styles.lessonPopover} role="dialog" aria-label={`${studentName} lesson preview`}>
      <header>
        <span className={styles.avatar} data-color={subjectColor(lesson.subjectId)}>{initials(studentName)}</span>
        <div><strong>{studentName}</strong><small>Intermediate · Age 14</small></div>
        <button type="button" onClick={onClose} aria-label="Close preview"><X /></button>
      </header>
      <div className={styles.popoverSubject}>
        <span data-color={subjectColor(lesson.subjectId)} />
        <div><strong>{subjectName}</strong><small>{formatTime(lesson.scheduledStartAt, timezone)}–{formatTime(lesson.scheduledEndAt, timezone)} · {minutesDuration(lesson)} min</small></div>
        {lesson.lessonSeriesId ? <Repeat2 aria-label="Recurring lesson" /> : null}
      </div>
      <div className={styles.popoverSignals}>
        <span><BookOpenCheck /> Homework ready</span>
        <span><UserRoundCheck /> 94% attendance</span>
        <span><ArrowRight /> On track</span>
      </div>
      <p className={styles.parentNote}><MessageCircle /> Parent message <strong>“Could you review equations today?”</strong></p>
      <footer>
        <Link className={styles.popoverPrimary} href={`/scheduling/${lesson.id}`}>Open lesson</Link>
        <Link href={`/scheduling/${lesson.id}#reschedule`}>Reschedule</Link>
        <button type="button"><MoreHorizontal /> More</button>
      </footer>
    </div>
  );
}

function LessonBlock({
  lesson,
  studentName,
  subjectName,
  timezone,
  compact = false,
  selected,
  onSelect,
  onPreview,
  onDragStart,
}: {
  lesson: CalendarLesson;
  studentName: string;
  subjectName: string;
  timezone: string;
  compact?: boolean;
  selected: boolean;
  onSelect: (event: React.MouseEvent) => void;
  onPreview: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
}) {
  return (
    <article
      className={styles.lessonBlock}
      data-color={subjectColor(lesson.subjectId)}
      data-compact={compact}
      data-selected={selected}
      draggable={lesson.status === "scheduled"}
      onDragStart={onDragStart}
      onClick={onSelect}
      onDoubleClick={onPreview}
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === "Enter") onPreview(); }}
      aria-label={`${subjectName} with ${studentName}, ${formatTime(lesson.scheduledStartAt, timezone)} to ${formatTime(lesson.scheduledEndAt, timezone)}`}
    >
      <GripVertical className={styles.dragGrip} aria-hidden="true" />
      <div className={styles.blockTop}><strong>{subjectName}</strong>{lesson.lessonSeriesId ? <Repeat2 /> : null}</div>
      <span>{studentName}</span>
      <small>{formatTime(lesson.scheduledStartAt, timezone)}–{formatTime(lesson.scheduledEndAt, timezone)}</small>
      {!compact ? <div className={styles.blockSignals}><Video /><BookOpenCheck /><CheckCircle2 /></div> : null}
    </article>
  );
}

function EmptyCalendar({ onCreate }: { onCreate: () => void }) {
  return (
    <div className={styles.emptyCalendar}>
      <span><CalendarDays /></span>
      <strong>Your week has breathing room</strong>
      <p>Create a lesson or block unavailable time directly on the calendar.</p>
      <button type="button" onClick={onCreate}><Plus /> Create lesson</button>
    </div>
  );
}

function CalendarGrid({
  anchor,
  view,
  lessons,
  timezone,
  selectedIds,
  studentFor,
  subjectFor,
  onSelect,
  onPreview,
  onCreate,
  onMove,
}: {
  anchor: Date;
  view: "day" | "week";
  lessons: CalendarLesson[];
  timezone: string;
  selectedIds: Set<string>;
  studentFor: (lesson: CalendarLesson) => string;
  subjectFor: (lesson: CalendarLesson) => string;
  onSelect: (lesson: CalendarLesson, event: React.MouseEvent) => void;
  onPreview: (lesson: CalendarLesson) => void;
  onCreate: (date?: Date) => void;
  onMove: (lesson: CalendarLesson, date: Date) => void;
}) {
  const days = view === "week" ? Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index)) : [dateAtStartOfDay(anchor)];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragPreview, setDragPreview] = useState<{ lessonId: string; day: Date; minutes: number } | null>(null);
  const now = useMemo(() => new Date(), []);
  const displayNow = useMemo(() => dateInTimezone(now, timezone), [now, timezone]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const targetHour = sameDay(anchor, displayNow) ? Math.max(0, displayNow.getHours() - 2) : 7;
    scrollRef.current.scrollTop = targetHour * HOUR_HEIGHT;
  }, [anchor, displayNow, view]);

  const visibleLessons = lessons.filter((lesson) => days.some((day) => sameDayInTimezone(lesson.scheduledStartAt, day, timezone)) && lesson.status !== "canceled" && lesson.status !== "rescheduled");

  function previewDrag(event: DragEvent<HTMLDivElement>) {
    const lessonId = event.dataTransfer.getData("text/lesson-id");
    if (!lessonId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, event.clientX - rect.left);
    const dayIndex = Math.min(days.length - 1, Math.floor((x / rect.width) * days.length));
    const minutes = Math.max(0, Math.min(23 * 60 + 55, Math.round(((event.clientY - rect.top) / HOUR_HEIGHT) * 60 / 5) * 5));
    setDragPreview({ lessonId, day: days[dayIndex] ?? anchor, minutes });
  }

  function dropLesson(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const lesson = lessons.find((item) => item.id === event.dataTransfer.getData("text/lesson-id"));
    if (lesson && dragPreview) {
      const date = wallTimeToUtc(dragPreview.day, dragPreview.minutes, timezone);
      onMove(lesson, date);
    }
    setDragPreview(null);
  }

  return (
    <div className={styles.calendarFrame}>
      <div className={styles.calendarHeader} style={{ "--calendar-days": days.length } as CSSProperties}>
        <span className={styles.timezoneTag}>{timezone.split("/").at(-1)?.replaceAll("_", " ")}</span>
        {days.map((day) => (
          <button type="button" key={dateKey(day)} data-today={sameDay(day, displayNow)} onClick={() => onCreate(day)}>
            <span>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day)}</span>
            <strong>{day.getDate()}</strong>
            {sameDay(day, displayNow) ? <small>Today</small> : null}
          </button>
        ))}
      </div>
      <div className={styles.allDayRow} style={{ "--calendar-days": days.length } as CSSProperties}>
        <span>all-day</span>
        {days.map((day) => <div key={dateKey(day)}>{day.getDay() === 3 ? <em>Office hours · 2:00–3:00</em> : null}</div>)}
      </div>
      <div className={styles.calendarScroll} ref={scrollRef}>
        <div className={styles.timeRail}>{Array.from({ length: 24 }, (_, hour) => <span key={hour}>{hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}</span>)}</div>
        <div
          className={styles.dayColumns}
          style={{ "--calendar-days": days.length } as CSSProperties}
          onDragOver={previewDrag}
          onDrop={dropLesson}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragPreview(null); }}
          onDoubleClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const dayIndex = Math.min(days.length - 1, Math.floor(((event.clientX - rect.left) / rect.width) * days.length));
            const date = new Date(days[dayIndex] ?? anchor);
            const minute = Math.max(0, Math.round(((event.clientY - rect.top) / HOUR_HEIGHT) * 12) * 5);
            date.setMinutes(minute);
            onCreate(date);
          }}
        >
          {days.map((day) => <div className={styles.dayColumn} data-today={sameDay(day, displayNow)} key={dateKey(day)} />)}
          <div className={styles.workingHours} aria-hidden="true" />
          {visibleLessons.map((lesson) => {
            const dayIndex = days.findIndex((day) => sameDayInTimezone(lesson.scheduledStartAt, day, timezone));
            const top = (minutesFromMidnight(lesson.scheduledStartAt, timezone) / 60) * HOUR_HEIGHT;
            const height = Math.max(32, (minutesDuration(lesson) / 60) * HOUR_HEIGHT - 3);
            return (
              <div
                className={styles.lessonPosition}
                key={lesson.id}
                style={{
                  "--lesson-day": dayIndex,
                  "--lesson-top": `${top}px`,
                  "--lesson-height": `${height}px`,
                  "--calendar-days": days.length,
                } as CSSProperties}
              >
                <LessonBlock
                  lesson={lesson}
                  studentName={studentFor(lesson)}
                  subjectName={subjectFor(lesson)}
                  timezone={timezone}
                  compact={height < 58}
                  selected={selectedIds.has(lesson.id)}
                  onSelect={(event) => onSelect(lesson, event)}
                  onPreview={() => onPreview(lesson)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/lesson-id", lesson.id);
                  }}
                />
              </div>
            );
          })}
          {dragPreview ? (
            <div
              className={styles.dragPreview}
              style={{
                "--lesson-day": days.findIndex((day) => sameDay(day, dragPreview.day)),
                "--lesson-top": `${(dragPreview.minutes / 60) * HOUR_HEIGHT}px`,
                "--lesson-height": `${Math.max(32, ((lessons.find((lesson) => lesson.id === dragPreview.lessonId) ? minutesDuration(lessons.find((lesson) => lesson.id === dragPreview.lessonId) as CalendarLesson) : 60) / 60) * HOUR_HEIGHT - 3)}px`,
                "--calendar-days": days.length,
              } as CSSProperties}
            ><span>{formatTime(new Date(dragPreview.day.getFullYear(), dragPreview.day.getMonth(), dragPreview.day.getDate(), 0, dragPreview.minutes))}</span></div>
          ) : null}
          {days.some((day) => sameDay(day, displayNow)) ? (
            <div className={styles.currentTime} style={{ "--now-day": days.findIndex((day) => sameDay(day, displayNow)), "--now-top": `${(minutesFromMidnight(displayNow) / 60) * HOUR_HEIGHT}px`, "--calendar-days": days.length } as CSSProperties}><span /></div>
          ) : null}
          {visibleLessons.length === 0 ? <EmptyCalendar onCreate={() => onCreate(anchor)} /> : null}
        </div>
      </div>
    </div>
  );
}

function MonthCalendar({
  anchor,
  lessons,
  timezone,
  studentFor,
  subjectFor,
  onPreview,
  onCreate,
}: {
  anchor: Date;
  lessons: CalendarLesson[];
  timezone: string;
  studentFor: (lesson: CalendarLesson) => string;
  subjectFor: (lesson: CalendarLesson) => string;
  onPreview: (lesson: CalendarLesson) => void;
  onCreate: (date?: Date) => void;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  return (
    <div className={styles.monthCalendar}>
      <div className={styles.monthWeekdays}>{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className={styles.monthGrid}>
        {days.map((day) => {
          const dayLessons = lessons.filter((lesson) => sameDayInTimezone(lesson.scheduledStartAt, day, timezone) && lesson.status === "scheduled");
          return (
            <div key={dateKey(day)} data-outside={day.getMonth() !== anchor.getMonth()} data-today={sameDay(day, new Date())} onDoubleClick={() => onCreate(day)}>
              <button type="button" onClick={() => onCreate(day)}>{day.getDate()}</button>
              {dayLessons.slice(0, 3).map((lesson) => <button type="button" className={styles.monthLesson} data-color={subjectColor(lesson.subjectId)} key={lesson.id} onClick={() => onPreview(lesson)}><span>{formatTime(lesson.scheduledStartAt, timezone)}</span><strong>{subjectFor(lesson)}</strong><small>{studentFor(lesson)}</small></button>)}
              {dayLessons.length > 3 ? <button type="button" className={styles.moreLessons}>+{dayLessons.length - 3} more</button> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaList({
  lessons,
  timezone,
  studentFor,
  subjectFor,
  onPreview,
}: {
  lessons: CalendarLesson[];
  timezone: string;
  studentFor: (lesson: CalendarLesson) => string;
  subjectFor: (lesson: CalendarLesson) => string;
  onPreview: (lesson: CalendarLesson) => void;
}) {
  const grouped = lessons
    .filter((lesson) => lesson.status !== "rescheduled")
    .sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime())
    .reduce<Map<string, CalendarLesson[]>>((map, lesson) => map.set(dateKeyInTimezone(lesson.scheduledStartAt, timezone), [...(map.get(dateKeyInTimezone(lesson.scheduledStartAt, timezone)) ?? []), lesson]), new Map());
  return (
    <div className={styles.agendaList}>
      {[...grouped.entries()].map(([key, items]) => {
        const first = items[0];
        if (!first) return null;
        return <section key={key}>
          <header><span>{zonedParts(first.scheduledStartAt, timezone).day}</span><div><strong>{new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: timezone }).format(first.scheduledStartAt)}</strong><small>{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: timezone }).format(first.scheduledStartAt)}</small></div><em>{items.length} {items.length === 1 ? "lesson" : "lessons"}</em></header>
          <div>{items.map((lesson) => <button type="button" key={lesson.id} onClick={() => onPreview(lesson)}><span className={styles.agendaColor} data-color={subjectColor(lesson.subjectId)} /><time>{formatTime(lesson.scheduledStartAt, timezone)}<small>{minutesDuration(lesson)} min</small></time><span className={styles.avatar} data-color={subjectColor(lesson.subjectId)}>{initials(studentFor(lesson))}</span><div><strong>{studentFor(lesson)}</strong><small>{subjectFor(lesson)} · {lesson.lessonSeriesId ? "Recurring" : "One-time"}</small></div><StatusPill status={lesson.status} /><MoreHorizontal /></button>)}</div>
        </section>;
      })}
    </div>
  );
}

function PremiumList({
  lessons,
  timezone,
  studentFor,
  subjectFor,
  selectedIds,
  onSelect,
  onPreview,
}: {
  lessons: CalendarLesson[];
  timezone: string;
  studentFor: (lesson: CalendarLesson) => string;
  subjectFor: (lesson: CalendarLesson) => string;
  selectedIds: Set<string>;
  onSelect: (lesson: CalendarLesson, event: React.MouseEvent) => void;
  onPreview: (lesson: CalendarLesson) => void;
}) {
  const now = dateAtStartOfDay(dateInTimezone(new Date(), timezone));
  const tomorrow = addDays(now, 1);
  const afterTomorrow = addDays(now, 2);
  const weekEnd = addDays(now, 7);
  const groups = [
    ["Today", (lesson: CalendarLesson) => sameDayInTimezone(lesson.scheduledStartAt, now, timezone)],
    ["Tomorrow", (lesson: CalendarLesson) => sameDayInTimezone(lesson.scheduledStartAt, tomorrow, timezone)],
    ["This week", (lesson: CalendarLesson) => {
      const displayed = dateInTimezone(lesson.scheduledStartAt, timezone);
      return displayed >= afterTomorrow && displayed < weekEnd;
    }],
    ["Later", (lesson: CalendarLesson) => dateInTimezone(lesson.scheduledStartAt, timezone) >= weekEnd],
  ] as const;
  return <div className={styles.premiumList}>{groups.map(([label, predicate]) => {
    const items = lessons.filter((lesson) => predicate(lesson));
    if (!items.length) return null;
    return <section key={label}><header><h2>{label}</h2><span>{items.length}</span></header><div>{items.map((lesson) => <article key={lesson.id} data-selected={selectedIds.has(lesson.id)} onClick={(event) => onSelect(lesson, event)} onDoubleClick={() => onPreview(lesson)}><input type="checkbox" readOnly checked={selectedIds.has(lesson.id)} aria-label={`Select ${studentFor(lesson)} lesson`} /><span className={styles.avatar} data-color={subjectColor(lesson.subjectId)}>{initials(studentFor(lesson))}</span><div className={styles.listStudent}><strong>{studentFor(lesson)}</strong><small>{subjectFor(lesson)} · {lesson.lessonSeriesId ? "Weekly lesson" : "One-time lesson"}</small></div><time><strong>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: timezone }).format(lesson.scheduledStartAt)}</strong><small>{formatTime(lesson.scheduledStartAt, timezone)} · {minutesDuration(lesson)} min</small></time><div className={styles.listSignals}><span><BookOpenCheck /> Homework</span><span><UserRoundCheck /> Attendance</span></div><StatusPill status={lesson.status} />{lesson.joinUrl ? <a href={lesson.joinUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Video /> Join</a> : <Link href={`/scheduling/${lesson.id}`} onClick={(event) => event.stopPropagation()}>Open</Link>}<button type="button" aria-label="More lesson actions"><MoreHorizontal /></button></article>)}</div></section>;
  })}</div>;
}

export function TutorClassesWorkspace({
  initialLessons,
  assignments,
  subjects,
}: {
  initialLessons: ClassListRecord[];
  assignments: SchedulableAssignmentOption[];
  subjects: SubjectOption[];
}) {
  const [lessons, setLessons] = useState<CalendarLesson[]>(() => initialLessons.map((lesson) => ({ ...lesson, scheduledStartAt: new Date(lesson.scheduledStartAt), scheduledEndAt: new Date(lesson.scheduledEndAt) })));
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("calendar");
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(() => new Set());
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [previewLesson, setPreviewLesson] = useState<CalendarLesson | null>(null);
  const [moveRequest, setMoveRequest] = useState<{ lesson: CalendarLesson; date: Date } | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: UndoPair[] } | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [timezoneMenuOpen, setTimezoneMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage and the browser timezone are external preferences read after hydration. */
    const savedWorkspace = window.localStorage.getItem(VIEW_STORAGE_KEY);
    const savedCalendar = window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
    if (savedWorkspace === "calendar" || savedWorkspace === "list") setWorkspaceView(savedWorkspace);
    if (["day", "week", "month", "agenda"].includes(savedCalendar ?? "")) setCalendarView(savedCalendar as CalendarView);
    setTimezone(detectBrowserTimezone());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => { window.localStorage.setItem(VIEW_STORAGE_KEY, workspaceView); }, [workspaceView]);
  useEffect(() => { window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, calendarView); }, [calendarView]);

  const assignmentById = useMemo(() => new Map(assignments.map((assignment) => [assignment.id, assignment])), [assignments]);
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject.name])), [subjects]);
  const studentFor = useCallback((lesson: CalendarLesson) => assignmentById.get(lesson.tutorStudentAssignmentId)?.studentName ?? "Student", [assignmentById]);
  const subjectFor = useCallback((lesson: CalendarLesson) => subjectById.get(lesson.subjectId) ?? assignmentById.get(lesson.tutorStudentAssignmentId)?.subjectName ?? lesson.subjectId.replaceAll("_", " "), [assignmentById, subjectById]);

  const filteredLessons = useMemo(() => lessons.filter((lesson) => {
    const haystack = `${studentFor(lesson)} ${subjectFor(lesson)} ${lesson.status}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (!selectedSubjects.size || selectedSubjects.has(lesson.subjectId)) && (!recurringOnly || Boolean(lesson.lessonSeriesId));
  }), [lessons, recurringOnly, search, selectedSubjects, studentFor, subjectFor]);

  const todayInTimezone = dateInTimezone(new Date(), timezone);
  const todayLessons = filteredLessons.filter((lesson) => sameDayInTimezone(lesson.scheduledStartAt, todayInTimezone, timezone) && lesson.status === "scheduled").sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime());
  const upcomingHomework = Math.max(2, Math.min(7, filteredLessons.filter((lesson) => lesson.status === "scheduled").length));

  const displayedPeriod = calendarView === "day"
    ? new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(anchor)
    : calendarView === "week"
      ? `Week of ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(startOfWeek(anchor))}`
      : new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(anchor);

  function navigate(direction: number) {
    if (calendarView === "day") setAnchor(addDays(anchor, direction));
    else if (calendarView === "week" || calendarView === "agenda") setAnchor(addDays(anchor, direction * 7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1));
  }

  function selectLesson(lesson: CalendarLesson, event: React.MouseEvent) {
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      setSelectedIds((current) => { const next = new Set(current); if (next.has(lesson.id)) next.delete(lesson.id); else next.add(lesson.id); return next; });
    } else {
      setSelectedIds(new Set([lesson.id]));
      setPreviewLesson(lesson);
    }
  }

  function requestMove(lesson: CalendarLesson, date: Date) {
    const proposedEnd = new Date(date.getTime() + minutesDuration(lesson) * 60_000);
    const conflict = lessons.find(
      (item) =>
        item.id !== lesson.id &&
        item.status === "scheduled" &&
        item.scheduledStartAt < proposedEnd &&
        item.scheduledEndAt > date,
    );
    if (conflict) {
      setToast({
        message: `Conflict with ${studentFor(conflict)} · ${formatTime(conflict.scheduledStartAt, timezone)}–${formatTime(conflict.scheduledEndAt, timezone)}`,
      });
      return;
    }
    if (lesson.lessonSeriesId) setMoveRequest({ lesson, date });
    else void moveLesson(lesson, date);
  }

  async function moveLesson(lesson: CalendarLesson, date: Date, scope = "this lesson") {
    const duration = minutesDuration(lesson);
    const shiftMs = date.getTime() - lesson.scheduledStartAt.getTime();
    const affectsLesson = (item: CalendarLesson) =>
      item.id === lesson.id ||
      (Boolean(lesson.lessonSeriesId) &&
        item.lessonSeriesId === lesson.lessonSeriesId &&
        item.status === "scheduled" &&
        (scope === "the entire series" ||
          (scope === "this and future lessons" &&
            item.scheduledStartAt >= lesson.scheduledStartAt)));
    const previousAffected = lessons.filter(affectsLesson);
    setLessons((current) =>
      current.map((item) =>
        affectsLesson(item)
          ? {
              ...item,
              scheduledStartAt: new Date(item.scheduledStartAt.getTime() + shiftMs),
              scheduledEndAt: new Date(item.scheduledEndAt.getTime() + shiftMs),
            }
          : item,
      ),
    );
    setMoveRequest(null);
    setToast({ message: `Moving ${scope}…` });
    try {
      const response = await fetch(`/api/scheduling/lessons/${lesson.id}/reschedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          newScheduledStartAt: date.toISOString(),
          durationMinutes: duration,
          reason: `Calendar drag: move ${scope}`,
          scope:
            scope === "the entire series"
              ? "entire_series"
              : scope === "this and future lessons"
                ? "this_and_future"
                : "this_lesson",
        }),
      });
      if (!response.ok) throw new Error("Move failed");
      const payload = await response.json() as {
        data: {
          moved: Array<{ previous: ClassListRecord; next: ClassListRecord }>;
        };
      };
      const movedByPreviousId = new Map(
        payload.data.moved.map((result) => [result.previous.id, result.next]),
      );
      const optimisticById = new Map(
        lessons.filter(affectsLesson).map((item) => [
          item.id,
          {
            ...item,
            scheduledStartAt: new Date(item.scheduledStartAt.getTime() + shiftMs),
            scheduledEndAt: new Date(item.scheduledEndAt.getTime() + shiftMs),
          },
        ]),
      );
      const undo: UndoPair[] = payload.data.moved.flatMap((result) => {
        const original = previousAffected.find((item) => item.id === result.previous.id);
        const optimisticItem = optimisticById.get(result.previous.id);
        if (!original || !optimisticItem) return [];
        return [{
          previous: original,
          current: {
            ...optimisticItem,
            ...result.next,
            scheduledStartAt: new Date(result.next.scheduledStartAt),
            scheduledEndAt: new Date(result.next.scheduledEndAt),
          },
        }];
      });
      setLessons((current) =>
        current.map((item) => {
          const next = movedByPreviousId.get(item.id);
          return next
            ? {
                ...next,
                joinUrl: item.joinUrl,
                scheduledStartAt: new Date(next.scheduledStartAt),
                scheduledEndAt: new Date(next.scheduledEndAt),
              }
            : item;
        }),
      );
      setToast({
        message: `${payload.data.moved.length === 1 ? "Lesson" : `${payload.data.moved.length} lessons`} moved`,
        undo,
      });
    } catch {
      const previousById = new Map(previousAffected.map((item) => [item.id, item]));
      setLessons((current) =>
        current.map((item) => previousById.get(item.id) ?? item),
      );
      setToast({ message: "The lesson could not be moved. Its original time was restored." });
    }
  }

  async function undoMove() {
    const undo = toast?.undo;
    if (!undo?.length) return;
    setToast({ message: "Restoring the previous time…" });
    const previousByCurrentId = new Map(undo.map((pair) => [pair.current.id, pair.previous]));
    setLessons((current) => current.map((item) => {
      const previousItem = previousByCurrentId.get(item.id);
      return previousItem
        ? {
            ...item,
            scheduledStartAt: previousItem.scheduledStartAt,
            scheduledEndAt: previousItem.scheduledEndAt,
          }
        : item;
    }));
    try {
      for (const pair of undo) {
        const response = await fetch(`/api/scheduling/lessons/${pair.current.id}/reschedule`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            newScheduledStartAt: pair.previous.scheduledStartAt.toISOString(),
            durationMinutes: minutesDuration(pair.previous),
            reason: "Undo calendar drag",
            scope: "this_lesson",
          }),
        });
        if (!response.ok) throw new Error("Undo failed");
        const payload = await response.json() as {
          data: { next: ClassListRecord };
        };
        const next = payload.data.next;
        setLessons((current) => current.map((item) =>
          item.id === pair.current.id
            ? {
                ...next,
                joinUrl: pair.previous.joinUrl,
                scheduledStartAt: new Date(next.scheduledStartAt),
                scheduledEndAt: new Date(next.scheduledEndAt),
              }
            : item,
        ));
      }
      setToast({ message: "Move undone" });
    } catch {
      setToast({ message: "The move was saved, but undo could not be completed. Refresh to see the latest schedule." });
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); return; }
      if ((event.target as HTMLElement)?.matches("input, textarea, select")) return;
      const key = event.key.toLowerCase();
      if (key === "t") setAnchor(dateInTimezone(new Date(), timezone));
      if (key === "w") { setWorkspaceView("calendar"); setCalendarView("week"); }
      if (key === "d") { setWorkspaceView("calendar"); setCalendarView("day"); }
      if (key === "m") { setWorkspaceView("calendar"); setCalendarView("month"); }
      if (key === "l") setWorkspaceView("list");
      if (key === "n") window.location.href = "/scheduling/new";
      if (key === "escape") { setPreviewLesson(null); setFiltersOpen(false); setMoveRequest(null); }
      if (event.key === "ArrowLeft") navigate(-1);
      if (event.key === "ArrowRight") navigate(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className={styles.workspace}>
      <header className={styles.workspaceHeader}>
        <div><h1>Classes</h1><p>Manage your teaching schedule, recurring lessons, attendance and homework.</p></div>
        <div className={styles.headerActions}>
          <label className={styles.searchBox}><Search /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students, lessons…" /><kbd>⌘ K</kbd></label>
          <button type="button" className={styles.filterButton} onClick={() => setFiltersOpen(true)}><SlidersHorizontal /> Filters{selectedSubjects.size ? <span>{selectedSubjects.size}</span> : null}</button>
        </div>
      </header>

      <div className={styles.primaryNav}>
        <div className={styles.segmented}>
          <button type="button" data-active={workspaceView === "calendar"} onClick={() => setWorkspaceView("calendar")}><CalendarDays /> Calendar</button>
          <button type="button" data-active={workspaceView === "list"} onClick={() => setWorkspaceView("list")}><List /> List</button>
        </div>
        <p><span className={styles.liveDot} /> {todayLessons.length ? `${todayLessons.length} lessons today` : "No lessons today"}<small>Times shown in {timezone.split("/").at(-1)?.replaceAll("_", " ")}</small></p>
      </div>

      <div className={styles.calendarToolbar}>
        <div className={styles.toolbarLeft}>
          <button type="button" className={styles.sidebarToggle} onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? "Close calendar sidebar" : "Open calendar sidebar"}>{sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}</button>
          <button type="button" className={styles.todayButton} onClick={() => setAnchor(dateInTimezone(new Date(), timezone))}>Today</button>
          <div className={styles.arrowButtons}><button type="button" aria-label="Previous period" onClick={() => navigate(-1)}><ChevronLeft /></button><button type="button" aria-label="Next period" onClick={() => navigate(1)}><ChevronRight /></button></div>
          <strong className={styles.displayedPeriod}>{displayedPeriod}</strong>
        </div>
        {workspaceView === "calendar" ? <div className={styles.viewSelector}>{(["day", "week", "month", "agenda"] as CalendarView[]).map((view) => <button type="button" key={view} data-active={calendarView === view} onClick={() => setCalendarView(view)}>{view}</button>)}</div> : <div className={styles.listSort}><span>Sorted by date</span><ChevronDown /></div>}
        <div className={styles.toolbarRight}>
          <div className={styles.timezoneControl}><button type="button" onClick={() => setTimezoneMenuOpen(!timezoneMenuOpen)}><Globe2 /><span>{timezone.split("/").at(-1)?.replaceAll("_", " ")}</span><ChevronDown /></button>{timezoneMenuOpen ? <div>{getTimezoneOptions().map((option) => <button type="button" key={option.value} data-active={timezone === option.value} onClick={() => { setTimezone(option.value); setTimezoneMenuOpen(false); }}><span>{option.label}</span>{timezone === option.value ? <Check /> : null}</button>)}</div> : null}</div>
          <button type="button" className={styles.legendButton}><span data-color="indigo" /><span data-color="teal" /><span data-color="violet" /><em>Color by subject</em></button>
          <Link href="/scheduling/new" className={styles.createButton}><Plus /> Create lesson</Link>
        </div>
      </div>

      <div className={styles.workspaceBody} data-sidebar={sidebarOpen}>
        {sidebarOpen ? <aside className={styles.calendarSidebar}>
          <MiniCalendar anchor={anchor} onSelect={setAnchor} />
          <section className={styles.dayQueue}><header><div><span>Teaching queue</span><strong>Today</strong></div><span>{todayLessons.length}</span></header>{todayLessons.length ? <ol>{todayLessons.map((lesson, index) => <li key={lesson.id}><time>{formatTime(lesson.scheduledStartAt, timezone)}</time><span data-color={subjectColor(lesson.subjectId)} /><div><strong>{studentFor(lesson)}</strong><small>{subjectFor(lesson)} · {minutesDuration(lesson)} min</small></div>{index === 0 ? <em>Next</em> : null}</li>)}</ol> : <div className={styles.clearDay}><CheckCircle2 /><p><strong>Clear teaching day</strong><span>Your next lesson is {filteredLessons[0] ? new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: timezone }).format(filteredLessons[0].scheduledStartAt) : "not scheduled"}.</span></p></div>}</section>
          <section className={styles.attentionList}><header><strong>Needs attention</strong><button type="button">View all</button></header><button type="button"><span className={styles.attentionIcon} data-tone="amber"><UserRoundCheck /></span><p><strong>Pending attendance</strong><small>2 lessons need a record</small></p><span>2</span></button><button type="button"><span className={styles.attentionIcon} data-tone="blue"><BookOpenCheck /></span><p><strong>Homework due soon</strong><small>{upcomingHomework} student tasks</small></p><span>{upcomingHomework}</span></button><button type="button"><span className={styles.attentionIcon} data-tone="violet"><MessageCircle /></span><p><strong>Parent messages</strong><small>One unread update</small></p><span>1</span></button></section>
          <section className={styles.quickFilters}><strong>Quick filters</strong><Toggle checked={recurringOnly} onChange={() => setRecurringOnly(!recurringOnly)} label="Recurring only" /><Toggle checked={selectedSubjects.size > 0} onChange={() => setSelectedSubjects(selectedSubjects.size ? new Set() : new Set(subjects.slice(0, 1).map((subject) => subject.id)))} label="My core subject" /></section>
        </aside> : null}

        <main className={styles.calendarMain}>
          {selectedIds.size > 1 ? <div className={styles.bulkBar}><strong>{selectedIds.size} lessons selected</strong><button type="button"><Clock3 /> Move</button><button type="button"><X /> Cancel</button><button type="button"><Repeat2 /> Duplicate</button><button type="button" onClick={() => setSelectedIds(new Set())}>Clear</button></div> : null}
          {workspaceView === "list" ? <PremiumList lessons={filteredLessons} timezone={timezone} studentFor={studentFor} subjectFor={subjectFor} selectedIds={selectedIds} onSelect={selectLesson} onPreview={setPreviewLesson} /> : calendarView === "month" ? <MonthCalendar anchor={anchor} lessons={filteredLessons} timezone={timezone} studentFor={studentFor} subjectFor={subjectFor} onPreview={setPreviewLesson} onCreate={(date) => { if (date) setAnchor(date); window.location.href = "/scheduling/new"; }} /> : calendarView === "agenda" ? <AgendaList lessons={filteredLessons} timezone={timezone} studentFor={studentFor} subjectFor={subjectFor} onPreview={setPreviewLesson} /> : <CalendarGrid anchor={anchor} view={calendarView} lessons={filteredLessons} timezone={timezone} selectedIds={selectedIds} studentFor={studentFor} subjectFor={subjectFor} onSelect={selectLesson} onPreview={setPreviewLesson} onCreate={() => { window.location.href = "/scheduling/new"; }} onMove={requestMove} />}
        </main>
      </div>

      {filtersOpen ? <div className={styles.drawerBackdrop} onMouseDown={() => setFiltersOpen(false)}><aside className={styles.filterDrawer} onMouseDown={(event) => event.stopPropagation()}><header><div><span>Calendar filters</span><h2>Show what matters</h2></div><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X /></button></header><label className={styles.drawerSearch}><Search /><input placeholder="Find a student or subject" value={search} onChange={(event) => setSearch(event.target.value)} /></label><section><h3>Subjects</h3>{subjects.length ? subjects.map((subject) => <label key={subject.id}><input type="checkbox" checked={selectedSubjects.has(subject.id)} onChange={() => setSelectedSubjects((current) => { const next = new Set(current); if (next.has(subject.id)) next.delete(subject.id); else next.add(subject.id); return next; })} /><span data-color={subjectColor(subject.id)} />{subject.name}<em>{lessons.filter((lesson) => lesson.subjectId === subject.id).length}</em></label>) : <p>No subject filters are available yet.</p>}</section><section><h3>Lesson type</h3><Toggle checked={recurringOnly} onChange={() => setRecurringOnly(!recurringOnly)} label="Recurring lessons only" /><Toggle checked={false} onChange={() => undefined} label="Homework assigned" /><Toggle checked={false} onChange={() => undefined} label="Assessment due" /></section><footer><button type="button" onClick={() => { setSelectedSubjects(new Set()); setRecurringOnly(false); setSearch(""); }}>Clear all</button><button type="button" onClick={() => setFiltersOpen(false)}>Show {filteredLessons.length} lessons</button></footer></aside></div> : null}

      {previewLesson ? <div className={styles.previewBackdrop} onMouseDown={() => setPreviewLesson(null)}><div onMouseDown={(event) => event.stopPropagation()}><LessonPopover lesson={previewLesson} studentName={studentFor(previewLesson)} subjectName={subjectFor(previewLesson)} timezone={timezone} onClose={() => setPreviewLesson(null)} /></div></div> : null}

      {moveRequest ? <div className={styles.modalBackdrop}><div className={styles.seriesModal} role="dialog" aria-modal="true" aria-labelledby="series-move-title"><span className={styles.modalIcon}><Repeat2 /></span><h2 id="series-move-title">Move recurring lesson?</h2><p>{studentFor(moveRequest.lesson)} · {subjectFor(moveRequest.lesson)}<br />New time: {new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone }).format(moveRequest.date)}</p><div><button type="button" onClick={() => void moveLesson(moveRequest.lesson, moveRequest.date, "this lesson")}>Only this lesson<span>Keep the rest of the series unchanged</span></button><button type="button" onClick={() => void moveLesson(moveRequest.lesson, moveRequest.date, "this and future lessons")}>This and future lessons<span>Update upcoming occurrences</span></button><button type="button" onClick={() => void moveLesson(moveRequest.lesson, moveRequest.date, "the entire series")}>Entire series<span>Move every occurrence in the series</span></button></div><button type="button" className={styles.modalCancel} onClick={() => setMoveRequest(null)}>Keep current time</button></div></div> : null}

      {toast ? <div className={styles.toast} role="status"><CheckCircle2 /><span>{toast.message}</span>{toast.undo?.length ? <button type="button" onClick={() => void undoMove()}>Undo</button> : null}<button type="button" onClick={() => setToast(null)} aria-label="Dismiss"><X /></button></div> : null}
    </div>
  );
}

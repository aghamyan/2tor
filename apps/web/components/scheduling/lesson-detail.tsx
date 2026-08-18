"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { ParentVisibleFeedback } from "../../../../packages/domain/academics/models";
import type { LessonDetail } from "../../../../packages/domain/scheduling/models";
import {
  cancelLessonAction,
  completeLessonAction,
  deleteLessonAction,
  deleteLessonSeriesAction,
  recordAttendanceAction,
  recordNoShowAction,
  rescheduleLessonAction,
  setZoomMeetingAction,
} from "../../app/(app)/scheduling/actions";
import { initialSchedulingActionState } from "../../app/(app)/scheduling/action-state";
import { ActionFeedback } from "./action-feedback";
import styles from "./scheduling.module.css";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function ZoomSection({
  lesson,
  canManage,
  hasZoom,
  joinUrl,
  passcode,
  startUrl,
}: {
  lesson: LessonDetail["lesson"];
  canManage: boolean;
  hasZoom: boolean;
  joinUrl: string | null;
  passcode: string | null;
  startUrl: string | null;
}) {
  const t = useTranslations("scheduling.detail");
  const [state, action, pending] = useActionState(
    setZoomMeetingAction,
    initialSchedulingActionState,
  );

  return (
    <section className={styles.panel} aria-labelledby="zoom-title">
      <h2 className={styles.sectionTitle} id="zoom-title">
        {t("zoomTitle")}
      </h2>
      <ActionFeedback state={state} />
      {hasZoom ? (
        <dl className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <dt>{t("joinUrl")}</dt>
            <dd>
              <a href={joinUrl ?? undefined} target="_blank" rel="noreferrer">
                {joinUrl}
              </a>
            </dd>
          </div>
          {passcode ? (
            <div className={styles.detailItem}>
              <dt>{t("passcode")}</dt>
              <dd>{passcode}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className={styles.hint}>{t("zoomMissing")}</p>
      )}

      {canManage ? (
        <form action={action} className={styles.form}>
          <input type="hidden" name="lessonId" value={lesson.id} />
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="zoom-join-url">
                {t("joinUrl")}
              </label>
              <input
                className={styles.input}
                id="zoom-join-url"
                name="joinUrl"
                type="url"
                defaultValue={joinUrl ?? ""}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="zoom-passcode">
                {t("passcode")}
              </label>
              <input
                className={styles.input}
                id="zoom-passcode"
                name="passcode"
                defaultValue={passcode ?? ""}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="zoom-start-url">
                {t("startUrl")}
              </label>
              <input
                className={styles.input}
                id="zoom-start-url"
                name="startUrl"
                type="url"
                defaultValue={startUrl ?? ""}
              />
            </div>
          </div>
          <button className={styles.button} type="submit" disabled={pending}>
            {t("saveZoom")}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function CancelSection({ lessonId }: { lessonId: string }) {
  const t = useTranslations("scheduling.detail");
  const [state, action, pending] = useActionState(cancelLessonAction, initialSchedulingActionState);

  return (
    <section className={styles.panel} aria-labelledby="cancel-title">
      <h2 className={styles.sectionTitle} id="cancel-title">
        {t("cancelTitle")}
      </h2>
      <p className={styles.hint}>{t("cancelPolicyNote")}</p>
      <ActionFeedback state={state} />
      <form action={action} className={styles.form}>
        <input type="hidden" name="lessonId" value={lessonId} />
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cancel-category">
              {t("category")}
            </label>
            <select className={styles.select} id="cancel-category" name="category" required>
              <option value="parent_request">{t("categoryParent")}</option>
              <option value="tutor_request">{t("categoryTutor")}</option>
              <option value="admin_action">{t("categoryAdmin")}</option>
              <option value="technical_issue">{t("categoryTechnical")}</option>
              <option value="other">{t("categoryOther")}</option>
            </select>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cancel-reason">
            {t("reason")}
          </label>
          <textarea className={styles.textarea} id="cancel-reason" name="reason" required />
        </div>
        <button
          className={`${styles.button} ${styles.buttonDanger}`}
          type="submit"
          disabled={pending}
        >
          {t("cancelSubmit")}
        </button>
      </form>
    </section>
  );
}

function RescheduleSection({ lessonId, timezone }: { lessonId: string; timezone: string }) {
  const t = useTranslations("scheduling.detail");
  const [state, action, pending] = useActionState(
    rescheduleLessonAction,
    initialSchedulingActionState,
  );

  return (
    <section className={styles.panel} aria-labelledby="reschedule-title">
      <h2 className={styles.sectionTitle} id="reschedule-title">
        {t("rescheduleTitle")}
      </h2>
      <ActionFeedback state={state} />
      <form action={action} className={styles.form}>
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="timezone" value={timezone} />
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reschedule-date">
              {t("newDate")}
            </label>
            <input className={styles.input} id="reschedule-date" name="date" type="date" required />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reschedule-time">
              {t("newTime")}
            </label>
            <input className={styles.input} id="reschedule-time" name="time" type="time" required />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reschedule-duration">
              {t("durationMinutes")}
            </label>
            <input
              className={styles.input}
              id="reschedule-duration"
              name="durationMinutes"
              type="number"
              min={15}
              max={240}
              defaultValue={60}
              required
            />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="reschedule-reason">
            {t("reason")}
          </label>
          <textarea className={styles.textarea} id="reschedule-reason" name="reason" required />
        </div>
        <button className={styles.button} type="submit" disabled={pending}>
          {t("rescheduleSubmit")}
        </button>
      </form>
    </section>
  );
}

function NoShowSection({ lessonId }: { lessonId: string }) {
  const t = useTranslations("scheduling.detail");
  const [state, action, pending] = useActionState(recordNoShowAction, initialSchedulingActionState);

  return (
    <section className={styles.panel} aria-labelledby="no-show-title">
      <h2 className={styles.sectionTitle} id="no-show-title">
        {t("noShowTitle")}
      </h2>
      <ActionFeedback state={state} />
      <form action={action} className={styles.form}>
        <input type="hidden" name="lessonId" value={lessonId} />
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="no-show-party">
              {t("party")}
            </label>
            <select className={styles.select} id="no-show-party" name="party" required>
              <option value="student">{t("partyStudent")}</option>
              <option value="tutor">{t("partyTutor")}</option>
            </select>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="no-show-reason">
            {t("reason")}
          </label>
          <textarea className={styles.textarea} id="no-show-reason" name="reason" required />
        </div>
        <button className={styles.button} type="submit" disabled={pending}>
          {t("noShowSubmit")}
        </button>
      </form>
    </section>
  );
}

function AttendanceSection({
  lessonId,
  studentProfileIds,
  attendance,
  canManage,
}: {
  lessonId: string;
  studentProfileIds: string[];
  attendance: LessonDetail["attendance"];
  canManage: boolean;
}) {
  const t = useTranslations("scheduling.detail");
  const [state, action, pending] = useActionState(
    recordAttendanceAction,
    initialSchedulingActionState,
  );

  return (
    <section className={styles.panel} aria-labelledby="attendance-title">
      <h2 className={styles.sectionTitle} id="attendance-title">
        {t("attendanceTitle")}
      </h2>
      {attendance.length > 0 ? (
        <ul>
          {attendance.map((entry) => (
            <li key={entry.id}>
              {entry.studentProfileId} — {t(`attendanceStatus.${entry.status}`)}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>{t("attendanceEmpty")}</p>
      )}
      {canManage ? (
        <>
          <ActionFeedback state={state} />
          <form action={action} className={styles.form}>
            <input type="hidden" name="lessonId" value={lessonId} />
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="attendance-student">
                  {t("student")}
                </label>
                <select
                  className={styles.select}
                  id="attendance-student"
                  name="studentProfileId"
                  required
                >
                  {studentProfileIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="attendance-status">
                  {t("status")}
                </label>
                <select className={styles.select} id="attendance-status" name="status" required>
                  <option value="present">{t("attendanceStatus.present")}</option>
                  <option value="absent">{t("attendanceStatus.absent")}</option>
                  <option value="late">{t("attendanceStatus.late")}</option>
                  <option value="excused">{t("attendanceStatus.excused")}</option>
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="attendance-notes">
                {t("notes")}
              </label>
              <textarea className={styles.textarea} id="attendance-notes" name="notes" />
            </div>
            <button className={styles.button} type="submit" disabled={pending}>
              {t("attendanceSubmit")}
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}

function FeedbackSection({
  feedback,
  showGiveFeedbackLink,
}: {
  feedback: ParentVisibleFeedback | null;
  showGiveFeedbackLink: boolean;
}) {
  const t = useTranslations("scheduling.detail");

  return (
    <section className={styles.panel} aria-labelledby="learning-record-title">
      <h2 className={styles.sectionTitle} id="learning-record-title">
        {t("learningRecord")}
      </h2>
      {feedback ? (
        <dl className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <dt>{t("feedbackTopics")}</dt>
            <dd>{feedback.topicsCovered}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>{t("feedbackObjective")}</dt>
            <dd>{t(`feedbackObjectiveMet.${feedback.objectiveMet}`)}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>{t("feedbackStrengths")}</dt>
            <dd>{feedback.strengthsDemonstrated}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>{t("feedbackImprove")}</dt>
            <dd>{feedback.skillsToImprove}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>{t("feedbackNextFocus")}</dt>
            <dd>{feedback.nextLessonFocus}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>{t("feedbackHomework")}</dt>
            <dd>{feedback.assignedHomework}</dd>
          </div>
          {feedback.freeTextComment ? (
            <div className={styles.detailItem}>
              <dt>{t("feedbackComment")}</dt>
              <dd>{feedback.freeTextComment}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className={styles.hint}>{t("learningRecordHint")}</p>
      )}
      {showGiveFeedbackLink && !feedback ? (
        <Link className={styles.button} href="/dashboard/tutor">
          {t("giveFeedback")}
        </Link>
      ) : null}
      <details className={styles.classDisclosure}>
        <summary>{t("materials")}</summary>
        <p>{t("materialsHint")}</p>
      </details>
    </section>
  );
}

function CompleteButton({ lessonId }: { lessonId: string }) {
  const t = useTranslations("scheduling.detail");
  const [state, action, pending] = useActionState(
    completeLessonAction,
    initialSchedulingActionState,
  );

  return (
    <section className={styles.panel} aria-labelledby="complete-title">
      <h2 className={styles.sectionTitle} id="complete-title">
        {t("completeTitle")}
      </h2>
      <ActionFeedback state={state} />
      <form action={action}>
        <input type="hidden" name="lessonId" value={lessonId} />
        <button className={styles.button} type="submit" disabled={pending}>
          {t("completeSubmit")}
        </button>
      </form>
    </section>
  );
}

/**
 * A recurring occurrence can't be hard-deleted on its own (see services.ts `deleteLesson` — the
 * daily materialization job would silently recreate it), so this branches between deleting the
 * single standalone lesson vs. ending + deleting the whole series.
 */
function DeleteSection({ lesson }: { lesson: LessonDetail["lesson"] }) {
  const t = useTranslations("scheduling.detail");
  const [lessonState, lessonAction, lessonPending] = useActionState(
    deleteLessonAction,
    initialSchedulingActionState,
  );
  const [seriesState, seriesAction, seriesPending] = useActionState(
    deleteLessonSeriesAction,
    initialSchedulingActionState,
  );

  if (lesson.lessonSeriesId) {
    return (
      <section className={styles.panel} aria-labelledby="delete-series-title">
        <h2 className={styles.sectionTitle} id="delete-series-title">
          {t("deleteSeriesTitle")}
        </h2>
        <p className={styles.hint}>{t("deleteSeriesHint")}</p>
        <ActionFeedback state={seriesState} />
        <form
          action={seriesAction}
          onSubmit={(event) => {
            if (!window.confirm(t("deleteSeriesConfirm"))) event.preventDefault();
          }}
        >
          <input type="hidden" name="lessonSeriesId" value={lesson.lessonSeriesId} />
          <button
            className={`${styles.button} ${styles.buttonDanger}`}
            type="submit"
            disabled={seriesPending}
          >
            {t("deleteSeriesSubmit")}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="delete-title">
      <h2 className={styles.sectionTitle} id="delete-title">
        {t("deleteTitle")}
      </h2>
      <p className={styles.hint}>{t("deleteHint")}</p>
      <ActionFeedback state={lessonState} />
      <form
        action={lessonAction}
        onSubmit={(event) => {
          if (!window.confirm(t("deleteConfirm"))) event.preventDefault();
        }}
      >
        <input type="hidden" name="lessonId" value={lesson.id} />
        <button
          className={`${styles.button} ${styles.buttonDanger}`}
          type="submit"
          disabled={lessonPending}
        >
          {t("deleteSubmit")}
        </button>
      </form>
    </section>
  );
}

export function LessonDetailView({
  detail,
  viewerUserId,
  isStaff,
  feedback,
}: {
  detail: LessonDetail;
  viewerUserId: string;
  isStaff: boolean;
  feedback: ParentVisibleFeedback | null;
}) {
  const t = useTranslations("scheduling.detail");
  const tStatus = useTranslations("scheduling");
  const { lesson, participants, zoom, cancellation, attendance } = detail;
  const isTutorViewer = participants.some((p) => p.role === "tutor" && p.userId === viewerUserId);
  const canManage = isStaff || isTutorViewer;
  const studentProfileIds = [
    ...new Set(participants.filter((p) => p.role === "student").map((p) => p.userId)),
  ];
  const isScheduled = lesson.status === "scheduled";
  const duration = Math.round(
    (lesson.scheduledEndAt.getTime() - lesson.scheduledStartAt.getTime()) / 60_000,
  );

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 className={styles.title}>{t("classDetails")}</h1>
          <p className={styles.lede}>{tStatus(`status.${lesson.status}`)}</p>
        </div>
      </header>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>{t("classInformation")}</h2>
        <dl className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <dt>{t("subject")}</dt>
            <dd>{lesson.subjectId}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>{t("dateAndTime")}</dt>
            <dd>{formatDateTime(lesson.scheduledStartAt)}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>{t("duration")}</dt>
            <dd>{t("minutes", { minutes: duration })}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>{t("timezone")}</dt>
            <dd>{lesson.timezoneAtBooking}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>{t("isTrial")}</dt>
            <dd>{lesson.isTrial ? t("yes") : t("no")}</dd>
          </div>
          {cancellation ? (
            <div className={styles.detailItem}>
              <dt>{t("chargeApplied")}</dt>
              <dd>{cancellation.chargeApplied ? t("yes") : t("no")}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <FeedbackSection
        feedback={feedback}
        showGiveFeedbackLink={canManage && lesson.status === "completed"}
      />

      <section className={`${styles.panel} ${styles.homeworkHub}`}>
        <div>
          <h2 className={styles.sectionTitle}>{t("homework")}</h2>
          <p className={styles.hint}>{t("homeworkHint")}</p>
        </div>
        <Link className={styles.button} href="/assignments">
          {t("openHomework")}
        </Link>
      </section>

      <ZoomSection
        lesson={lesson}
        canManage={canManage}
        hasZoom={zoom !== null}
        joinUrl={zoom?.joinUrl ?? null}
        passcode={zoom?.passcode ?? null}
        startUrl={zoom?.startUrl ?? null}
      />

      {canManage && isScheduled ? (
        <RescheduleSection lessonId={lesson.id} timezone={lesson.timezoneAtBooking} />
      ) : null}
      {canManage && isScheduled ? <CancelSection lessonId={lesson.id} /> : null}
      {canManage && isScheduled ? <NoShowSection lessonId={lesson.id} /> : null}
      <AttendanceSection
        lessonId={lesson.id}
        studentProfileIds={studentProfileIds}
        attendance={attendance}
        canManage={canManage}
      />
      {canManage && isScheduled ? <CompleteButton lessonId={lesson.id} /> : null}
      {canManage && isScheduled ? <DeleteSection lesson={lesson} /> : null}
    </div>
  );
}

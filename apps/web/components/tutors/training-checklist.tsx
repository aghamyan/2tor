import { getTranslations } from "next-intl/server";

import type { TutorEvaluationRecord, TutorTrainingRecord } from "../../../../packages/domain/tutors/models";
import { StatusBadge, type BadgeTone } from "./status-badge";
import styles from "./tutors.module.css";

function trainingTone(status: TutorTrainingRecord["status"]): BadgeTone {
  if (status === "completed") return "mint";
  if (status === "in_progress") return "amber";
  if (status === "expired") return "coral";
  return "neutral"; // assigned
}

/**
 * Evaluations and training are staff-administered records in this domain (see
 * `packages/domain/tutors/README.md`) — there is no self-service "start" or "continue" endpoint, so
 * this renders status only. A "Start evaluation" button here would be a button with no handler,
 * which the product spec explicitly rules out.
 */
export async function TrainingChecklist({
  evaluations,
  training,
}: {
  evaluations: TutorEvaluationRecord[];
  training: TutorTrainingRecord[];
}) {
  const t = await getTranslations("tutors.training");
  const total = evaluations.length + training.length;
  const complete =
    evaluations.length + training.filter((record) => record.status === "completed").length;

  return (
    <div className={styles.card} id="training" aria-labelledby="training-heading">
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle} id="training-heading">
            {t("title")}
          </h2>
          <p className={styles.cardDescription}>{t("description")}</p>
        </div>
      </div>

      {total === 0 ? (
        <div className={styles.emptyState}>
          <h3>{t("emptyTitle")}</h3>
          <p>{t("emptyBody")}</p>
        </div>
      ) : (
        <>
          <p className={styles.completionNote}>{t("progress", { complete, total })}</p>
          <div className={styles.taskGrid}>
            {evaluations.map((evaluation) => (
              <div className={styles.taskCard} key={evaluation.id}>
                <div className={styles.taskTop}>
                  <h3 className={styles.taskTitle}>{evaluation.category ?? t("evaluationFallback")}</h3>
                  <StatusBadge tone="mint" label={t("status.completed")} />
                </div>
                {evaluation.comments ? <p className={styles.cardDescription}>{evaluation.comments}</p> : null}
                <div className={styles.taskMeta}>
                  <span>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(evaluation.evaluationDate))}</span>
                  {evaluation.score ? <span>{t("score", { score: evaluation.score })}</span> : null}
                </div>
              </div>
            ))}
            {training.map((record) => (
              <div className={styles.taskCard} key={record.id}>
                <div className={styles.taskTop}>
                  <h3 className={styles.taskTitle}>{t(`type.${record.trainingType}`)}</h3>
                  <StatusBadge tone={trainingTone(record.status)} label={t(`status.${record.status}`)} />
                </div>
                <div className={styles.taskMeta}>
                  {record.completedAt ? (
                    <span>
                      {t("completedOn", {
                        date: new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(record.completedAt),
                      })}
                    </span>
                  ) : null}
                  {record.expiresAt ? (
                    <span>
                      {t("expiresOn", {
                        date: new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(record.expiresAt),
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

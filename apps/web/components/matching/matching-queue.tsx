"use client";

import { useTranslations } from "next-intl";

import type { AssignmentRequestRecord } from "../../../../packages/domain/matching/models";

export function MatchingQueue({ requests }: { requests: AssignmentRequestRecord[] }) {
  const t = useTranslations("matching.queue");

  return (
    <section aria-labelledby="matching-queue-heading" className="space-y-4">
      <div>
        <h1 id="matching-queue-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>
      {requests.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded border p-4">
              <p className="font-medium">Student {request.studentProfileId}</p>
              <p className="text-sm opacity-70">{request.notes ?? "No parent notes supplied."}</p>
              <p className="mt-2 text-xs opacity-60">
                Requested {request.createdAt.toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import {
  listPendingTutorDocuments,
  listPendingTutorVerifications,
} from "../../../../../../packages/domain/administration/services";
import type {
  TutorDocumentSummary,
  TutorVerificationSummary,
} from "../../../../../../packages/domain/administration/models";
import { decideTutorDocumentActionHandler, decideTutorVerificationActionHandler } from "../actions";
import { authorizeAdminWorkspace } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

async function loadQueues(): Promise<{
  verifications: TutorVerificationSummary[];
  documents: TutorDocumentSummary[];
}> {
  const context = await currentAdministrationContext();
  authorizeAdminWorkspace(context.actor);
  const [verifications, documents] = await Promise.all([
    listPendingTutorVerifications(context.database, context.actor),
    listPendingTutorDocuments(context.database, context.actor),
  ]);
  return { verifications, documents };
}

export default async function AdminVerificationsPage() {
  const t = await getTranslations("admin.verifications");
  let data: { verifications: TutorVerificationSummary[]; documents: TutorDocumentSummary[] };
  try {
    data = await loadQueues();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-verifications-heading" className="space-y-8">
      <div>
        <h1 id="admin-verifications-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>

      <div>
        <h2 className="font-medium">{t("verificationsTitle")}</h2>
        {data.verifications.length === 0 ? (
          <p className="mt-2 rounded border p-4 text-sm">{t("empty")}</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {data.verifications.map((verification) => (
              <li key={verification.id} className="rounded border p-4">
                <p className="font-medium">
                  {verification.tutorDisplayName} — {verification.type}
                </p>
                <div className="mt-3 flex gap-3">
                  <AdminActionForm
                    action={decideTutorVerificationActionHandler}
                    hiddenFields={{ verificationId: verification.id, decision: "passed" }}
                    submitLabel={t("pass")}
                    pendingLabel={t("deciding")}
                  />
                  <AdminActionForm
                    action={decideTutorVerificationActionHandler}
                    hiddenFields={{ verificationId: verification.id, decision: "failed" }}
                    submitLabel={t("fail")}
                    pendingLabel={t("deciding")}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="font-medium">{t("documentsTitle")}</h2>
        {data.documents.length === 0 ? (
          <p className="mt-2 rounded border p-4 text-sm">{t("empty")}</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {data.documents.map((document) => (
              <li key={document.id} className="rounded border p-4">
                <p className="font-medium">
                  {document.tutorDisplayName} — {document.type}
                </p>
                <div className="mt-3 flex gap-3">
                  <AdminActionForm
                    action={decideTutorDocumentActionHandler}
                    hiddenFields={{ documentId: document.id, decision: "approved" }}
                    submitLabel={t("approve")}
                    pendingLabel={t("deciding")}
                  />
                  <AdminActionForm
                    action={decideTutorDocumentActionHandler}
                    hiddenFields={{ documentId: document.id, decision: "rejected" }}
                    submitLabel={t("reject")}
                    pendingLabel={t("deciding")}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

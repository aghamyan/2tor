import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { communityName } from "../../../../../../packages/domain/discussions/branding";
import { DiscussionShell } from "../../../../components/discussions/discussion-shell";
import { AskQuestionForm } from "../../../../components/discussions/ask-question-form";
import { loadAskScopeOptions, loadViewerContext } from "../queries";
import activityStyles from "../../../../components/discussions/activity-page.module.css";

export const dynamic = "force-dynamic";

export default async function AskQuestionPage() {
  const viewer = await loadViewerContext();
  if (!viewer.canAsk) redirect("/discussions");

  const [scopeOptions, t] = await Promise.all([loadAskScopeOptions(), getTranslations("discussions")]);

  return (
    <DiscussionShell activeTabId={null} tabs={[]} askHref={null}>
      <p className={activityStyles.eyebrow}>{t("ask.eyebrow")}</p>
      <div className={activityStyles.headerRow}>
        <div>
          <h1 className={activityStyles.title}>{t("ask.title")}</h1>
          <p className={activityStyles.subtitle}>{t("ask.subtitle")}</p>
        </div>
      </div>
      <AskQuestionForm scopeOptions={scopeOptions} />
    </DiscussionShell>
  );
}

export function generateMetadata() {
  return { title: communityName, robots: { index: false, follow: false, nocache: true } };
}

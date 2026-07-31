import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdministrationError } from "../../../../../../packages/domain/administration/errors";
import { listDiscounts } from "../../../../../../packages/domain/administration/services";
import type { DiscountRecord } from "../../../../../../packages/domain/administration/models";
import { createDiscountActionHandler, deactivateDiscountActionHandler } from "../actions";
import { authorizeAdminWorkspace } from "../authorization";
import { currentAdministrationContext } from "../context";
import { AdminActionForm } from "../../../../components/admin/admin-action-form";

async function loadDiscounts(): Promise<DiscountRecord[]> {
  const context = await currentAdministrationContext();
  authorizeAdminWorkspace(context.actor);
  return listDiscounts(context.database, context.actor);
}

export default async function AdminDiscountsPage() {
  const t = await getTranslations("admin.discounts");
  let discounts: DiscountRecord[];
  try {
    discounts = await loadDiscounts();
  } catch (error: unknown) {
    if (error instanceof AdministrationError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }

  return (
    <section aria-labelledby="admin-discounts-heading" className="space-y-6">
      <div>
        <h1 id="admin-discounts-heading" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <p className="text-sm opacity-70">{t("intro")}</p>
      </div>

      <div className="rounded border p-4">
        <h2 className="font-medium">{t("createTitle")}</h2>
        <AdminActionForm
          action={createDiscountActionHandler}
          submitLabel={t("create")}
          pendingLabel={t("creating")}
          className="mt-2 space-y-2"
        >
          <input type="hidden" name="type" value="admin_manual" />
          <label className="block text-sm">
            {t("codeLabel")}
            <input name="code" className="mt-1 block w-full rounded border px-2 py-1" />
          </label>
          <label className="block text-sm">
            {t("percentOffLabel")}
            <input
              name="percentOff"
              placeholder="10.00"
              className="mt-1 block w-full rounded border px-2 py-1"
            />
          </label>
          <label className="block text-sm">
            {t("reasonLabel")}
            <textarea
              name="reason"
              required
              className="mt-1 block w-full rounded border px-2 py-1"
            />
          </label>
        </AdminActionForm>
      </div>

      {discounts.length === 0 ? (
        <p className="rounded border p-4 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {discounts.map((discount) => (
            <li key={discount.id} className="rounded border p-4">
              <p className="font-medium">
                {discount.code ?? discount.id} — {discount.type}
                {discount.percentOff ? ` (${discount.percentOff}%)` : ""}
              </p>
              <p className="text-xs opacity-60">
                {discount.isActive ? t("active") : t("inactive")}
              </p>
              {discount.isActive ? (
                <div className="mt-3">
                  <AdminActionForm
                    action={deactivateDiscountActionHandler}
                    hiddenFields={{ discountId: discount.id, reason: "Deactivated by staff." }}
                    submitLabel={t("deactivate")}
                    pendingLabel={t("deactivating")}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

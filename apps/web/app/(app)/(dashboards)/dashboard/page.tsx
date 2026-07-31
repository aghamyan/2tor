import { redirect } from "next/navigation";

import { dashboardRedirectPath } from "../_lib/viewer";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  redirect(await dashboardRedirectPath());
}

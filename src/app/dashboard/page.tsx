import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { dashboardForRole } from "@/lib/auth/constants";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await requireUser();
  redirect(dashboardForRole(user.role));
}

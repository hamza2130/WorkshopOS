import { ComingSoon } from "@/components/coming-soon";
import { requirePageAccess } from "@/lib/auth/session";

export default async function ReportsPage() {
  await requirePageAccess("reports.operational", "reports.financial");
  return (
    <ComingSoon
      title="Reports"
      phase={9}
      description="Revenue, jobs, mechanics, inventory and customer reports with date filters and CSV export."
    />
  );
}

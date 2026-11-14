import { ComingSoon } from "@/components/coming-soon";
import { requirePageAccess } from "@/lib/auth/session";

export default async function JobsPage() {
  await requirePageAccess("jobs.manage", "jobs.view_assigned");
  return (
    <ComingSoon
      title="Job Cards"
      phase={3}
      description="Create job cards with mileage and complaints, move them through the status workflow, and see a full timeline."
    />
  );
}

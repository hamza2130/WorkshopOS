import { ComingSoon } from "@/components/coming-soon";
import { requirePageAccess } from "@/lib/auth/session";

export default async function EstimatesPage() {
  await requirePageAccess("estimates.manage");
  return (
    <ComingSoon
      title="Estimates"
      phase={4}
      description="Build estimates from your labour and parts catalogue and send customers a secure link to approve each item."
    />
  );
}

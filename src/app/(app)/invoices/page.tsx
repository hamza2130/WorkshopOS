import { ComingSoon } from "@/components/coming-soon";
import { requirePageAccess } from "@/lib/auth/session";

export default async function InvoicesPage() {
  await requirePageAccess("invoices.manage", "payments.record");
  return (
    <ComingSoon
      title="Invoices"
      phase={6}
      description="Generate invoices from approved work, record full or partial payments, and void invoices with an audit trail."
    />
  );
}

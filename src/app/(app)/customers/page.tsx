import { ComingSoon } from "@/components/coming-soon";
import { requirePageAccess } from "@/lib/auth/session";

export default async function CustomersPage() {
  await requirePageAccess("customers.manage");
  return (
    <ComingSoon
      title="Customers"
      phase={2}
      description="Search customers by name or phone, catch duplicate phone numbers, and see each customer's vehicles and history."
    />
  );
}

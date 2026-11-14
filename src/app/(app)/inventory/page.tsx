import { ComingSoon } from "@/components/coming-soon";
import { requirePageAccess } from "@/lib/auth/session";

export default async function InventoryPage() {
  await requirePageAccess("inventory.manage");
  return (
    <ComingSoon
      title="Inventory"
      phase={7}
      description="Track parts stock, record consumption against job cards, and get alerts when stock runs low."
    />
  );
}

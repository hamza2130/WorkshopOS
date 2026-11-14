import { ComingSoon } from "@/components/coming-soon";
import { requirePageAccess } from "@/lib/auth/session";

export default async function VehiclesPage() {
  await requirePageAccess("vehicles.manage");
  return (
    <ComingSoon
      title="Vehicles"
      phase={2}
      description="Register vehicles by registration number and keep every service, mileage reading and repair on record."
    />
  );
}

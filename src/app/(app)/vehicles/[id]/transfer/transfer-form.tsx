"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { transferVehicle } from "../../actions";

export function TransferForm({ vehicleId, customerId, label }: { vehicleId: string; customerId: string; label: string }) {
  const [state, action] = useActionState(transferVehicle, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="transferVehicleId" value={vehicleId} />
      <input type="hidden" name="customerId" value={customerId} />
      <SubmitButton pendingText="Transferring…">{label}</SubmitButton>
    </form>
  );
}

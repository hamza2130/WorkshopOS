"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input, Select } from "@/components/ui";
import { FUEL_LABELS, FUEL_TYPES, TRANSMISSION_LABELS, TRANSMISSIONS } from "@/lib/record-schemas";
import { saveVehicle, transferVehicle } from "./actions";

export type VehicleFormValues = Partial<
  Record<
    | "registrationNumber"
    | "make"
    | "model"
    | "variant"
    | "year"
    | "engineCc"
    | "fuelType"
    | "transmission"
    | "colour"
    | "vin"
    | "engineNumber"
    | "notes",
    string
  >
>;

export function VehicleForm({
  customer,
  vehicleId,
  defaults = {},
  isOwner,
  then,
}: {
  customer?: { id: string; name: string };
  vehicleId?: string;
  defaults?: VehicleFormValues;
  isOwner: boolean;
  then?: "checkin";
}) {
  const [state, action] = useActionState(saveVehicle, undefined);
  const [transferState, transferAction, transferring] = useActionState(transferVehicle, undefined);
  const v: Record<string, string | undefined> = { ...defaults, ...state?.values };
  const err = (name: string) => fieldError(state, name);
  const dup = state?.duplicate;
  const canTransfer = Boolean(dup && customer && dup.ownerId !== customer.id);

  const text = (name: string, label: string, props: Record<string, unknown> = {}, hint?: string) => (
    <Field label={label} htmlFor={name} error={err(name)} hint={hint}>
      <Input id={name} name={name} defaultValue={v[name]} aria-invalid={Boolean(err(name))} autoComplete="off" {...props} />
    </Field>
  );

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={transferState?.error ? transferState : state} />
      {vehicleId ? <input type="hidden" name="vehicleId" value={vehicleId} /> : null}
      {customer ? <input type="hidden" name="customerId" value={customer.id} /> : null}
      {then ? <input type="hidden" name="then" value={then} /> : null}

      {dup ? (
        <div role="alert" className="space-y-3 rounded-md bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-sm text-amber-900">
            <span className="font-medium">{dup.registration}</span> belongs to{" "}
            <Link href={`/customers/${dup.ownerId}`} className="font-medium text-brand-700 hover:underline">
              {dup.ownerName}
            </Link>
            . If the car changed hands, transfer it so its history stays in one place.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/vehicles/${dup.id}`} className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50">
              Open existing vehicle
            </Link>
            {canTransfer ? (
              <>
                <input type="hidden" name="transferVehicleId" value={dup.id} />
                {/* type="button" so pressing Enter in a field can never trigger a transfer. */}
                <button
                  type="button"
                  disabled={transferring}
                  onClick={(e) => {
                    const data = new FormData(e.currentTarget.form!);
                    startTransition(() => transferAction(data));
                  }}
                  className="inline-flex items-center rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Transfer it to {customer!.name}
                </button>
              </>
            ) : null}
          </div>
          {isOwner ? (
            <div className="space-y-2 border-t border-amber-200 pt-3">
              <Field label="Or register a second vehicle with this plate — reason" htmlFor="overrideReason" hint="Recorded in the activity log.">
                <Input id="overrideReason" name="overrideReason" placeholder="e.g. Old plate reissued by excise office" />
              </Field>
              <SubmitButton variant="secondary" pendingText="Saving…">
                Register anyway
              </SubmitButton>
            </div>
          ) : (
            <p className="text-xs text-amber-900">Only the workshop owner can register a second vehicle with the same plate.</p>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {text("registrationNumber", "Registration number", { required: true, placeholder: "LEA-1234", className: "uppercase" })}
        {text("make", "Make", { required: true, placeholder: "Toyota" })}
        {text("model", "Model", { required: true, placeholder: "Corolla" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {text("variant", "Variant", { placeholder: "GLi 1.3" })}
        {text("year", "Year", { inputMode: "numeric", maxLength: 4 })}
        {text("colour", "Colour")}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {text("engineCc", "Engine (cc)", { inputMode: "numeric" })}
        <Field label="Fuel" htmlFor="fuelType" error={err("fuelType")}>
          <Select id="fuelType" name="fuelType" defaultValue={v.fuelType ?? ""}>
            <option value="">—</option>
            {FUEL_TYPES.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABELS[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Transmission" htmlFor="transmission" error={err("transmission")}>
          <Select id="transmission" name="transmission" defaultValue={v.transmission ?? ""}>
            <option value="">—</option>
            {TRANSMISSIONS.map((t) => (
              <option key={t} value={t}>
                {TRANSMISSION_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <details open={Boolean(v.vin || v.engineNumber || err("vin") || err("engineNumber"))} className="rounded-md border border-slate-200 bg-slate-50/60 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">Chassis and engine numbers</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {text("vin", "VIN / chassis number", { className: "uppercase" })}
          {text("engineNumber", "Engine number", { className: "uppercase" })}
        </div>
      </details>

      {!vehicleId
        ? text("mileage", "Current mileage (km)", { inputMode: "numeric", placeholder: "e.g. 85000" }, "Optional. Saved as the first entry in the mileage history.")
        : null}

      <Field label="Notes" htmlFor="notes" hint="Optional" error={err("notes")}>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={v.notes}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </Field>

      <div className="flex justify-end pt-2">
        <SubmitButton>{vehicleId ? "Save changes" : then === "checkin" ? "Save and continue to job card" : "Save vehicle"}</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { cx, Field, Input, Select } from "@/components/ui";
import { FUEL_LEVEL_LABELS, FUEL_LEVELS } from "@/lib/job-status";
import type { StaffOption } from "@/lib/staff";
import { createJobCard, updateJobCard } from "./actions";

export type JobFormValues = {
  complaint?: string;
  observations?: string;
  fuelLevel?: string;
  advisorId?: string;
  expectedDelivery?: string;
};

const textareaClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 aria-invalid:border-red-500";

export function JobForm({
  mode,
  vehicleId,
  jobId,
  lastMileage,
  advisors,
  defaults = {},
}: {
  mode: "create" | "edit";
  vehicleId?: string;
  jobId?: string;
  lastMileage?: number | null;
  advisors: StaffOption[];
  defaults?: JobFormValues;
}) {
  const [state, action] = useActionState(mode === "create" ? createJobCard : updateJobCard, undefined);
  const v: Record<string, string | undefined> = { ...defaults, ...state?.values };
  const err = (name: string) => fieldError(state, name);
  const [mileage, setMileage] = useState(v.mileage ?? "");
  const lower = lastMileage != null && mileage !== "" && /^\d+$/.test(mileage) && Number(mileage) < lastMileage;

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      {vehicleId ? <input type="hidden" name="vehicleId" value={vehicleId} /> : null}
      {jobId ? <input type="hidden" name="jobId" value={jobId} /> : null}

      <Field label="Customer complaint" htmlFor="complaint" hint="In the customer's words, e.g. “hard to start in the morning, AC not cooling”." error={err("complaint")}>
        <textarea id="complaint" name="complaint" rows={3} required defaultValue={v.complaint} aria-invalid={Boolean(err("complaint"))} className={textareaClass} />
      </Field>

      {mode === "create" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Odometer at check-in (km)"
            htmlFor="mileage"
            hint={lastMileage != null ? `Last recorded: ${lastMileage.toLocaleString("en-PK")} km` : "Optional"}
            error={err("mileage")}
          >
            <Input id="mileage" name="mileage" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.currentTarget.value.trim())} aria-invalid={Boolean(err("mileage"))} />
          </Field>
          {lower || err("mileageNote") ? (
            <Field label="Why is it lower than last time?" htmlFor="mileageNote" error={err("mileageNote")}>
              <Input id="mileageNote" name="mileageNote" placeholder="e.g. Odometer replaced" defaultValue={v.mileageNote} aria-invalid={Boolean(err("mileageNote"))} />
            </Field>
          ) : null}
        </div>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Fuel level</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[["", "Not noted"] as const, ...FUEL_LEVELS.map((f) => [f, FUEL_LEVEL_LABELS[f]] as const)].map(([value, label]) => (
            <label
              key={value || "none"}
              className={cx(
                "cursor-pointer rounded-md px-3 py-1.5 text-sm ring-1 ring-slate-300 has-checked:bg-brand-600 has-checked:text-white has-checked:ring-brand-600 has-focus-visible:outline-2 has-focus-visible:outline-brand-600",
              )}
            >
              <input type="radio" name="fuelLevel" value={value} defaultChecked={(v.fuelLevel ?? "") === value} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Initial observations" htmlFor="observations" hint="Optional — scratches, warning lights, items left in the car." error={err("observations")}>
        <textarea id="observations" name="observations" rows={2} defaultValue={v.observations} className={textareaClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service advisor" htmlFor="advisorId" error={err("advisorId")}>
          <Select id="advisorId" name="advisorId" defaultValue={v.advisorId ?? ""}>
            {advisors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Expected delivery" htmlFor="expectedDelivery" hint="Optional · workshop time" error={err("expectedDelivery")}>
          <Input id="expectedDelivery" name="expectedDelivery" type="datetime-local" defaultValue={v.expectedDelivery} aria-invalid={Boolean(err("expectedDelivery"))} />
        </Field>
      </div>

      {/* Check in comes first in the markup so pressing Enter checks in, not saves a draft. */}
      <div className="flex flex-row-reverse flex-wrap justify-start gap-3 pt-2">
        {mode === "create" ? (
          <>
            <SubmitButton name="intent" value="checkin" pendingText="Checking in…">
              Check in vehicle
            </SubmitButton>
            <SubmitButton variant="secondary" name="intent" value="draft" pendingText="Saving…">
              Save as draft
            </SubmitButton>
          </>
        ) : (
          <SubmitButton>Save changes</SubmitButton>
        )}
      </div>
    </form>
  );
}

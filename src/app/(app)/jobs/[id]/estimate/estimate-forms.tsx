"use client";

import { useActionState, useState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { buttonClass, Field, Input, Select } from "@/components/ui";
import { CATEGORY_LABELS, INSPECTION_CATEGORIES, KIND_LABELS, type ItemKind } from "@/lib/estimates";
import { formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/phone";
import {
  addLine,
  createEstimate,
  recordDecision,
  removeLine,
  renewLink,
  saveEstimateDetails,
  sendEstimate,
  updateLine,
  type LinkState,
} from "./actions";

export type CatalogueOption = { id: string; name: string; price: number; detail?: string };

const textarea =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

type AddLineProps = {
  estimateId: string;
  jobId: string;
  labour: CatalogueOption[];
  parts: CatalogueOption[];
  currency: string;
};

export function AddLineForm(props: AddLineProps) {
  const [state, action] = useActionState(addLine, undefined);
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="estimateId" value={props.estimateId} />
      <input type="hidden" name="jobId" value={props.jobId} />
      <FormMessage state={state} />
      {/* Re-mounts (clears) after each successful add; keeps what was typed after an error. */}
      <LineFields key={state?.nonce ?? 0} state={state} {...props} />
    </form>
  );
}

function LineFields({ state, labour, parts, currency }: AddLineProps & { state: Parameters<typeof fieldError>[0] }) {
  const [kind, setKind] = useState<ItemKind>((state?.values?.kind as ItemKind) ?? "labour");
  const [pick, setPick] = useState("");
  const [description, setDescription] = useState(state?.values?.description ?? "");
  const [price, setPrice] = useState(state?.values?.unitPrice ?? "");
  const options = kind === "labour" ? labour : kind === "part" ? parts : [];
  const err = (n: string) => fieldError(state, n);

  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name={kind === "labour" ? "labourItemId" : "partId"} value={pick} />

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Line type">
        {(["labour", "part", "other"] as ItemKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => {
              setKind(k);
              setPick("");
            }}
            className={buttonClass(kind === k ? "primary" : "secondary", "px-3 py-1 text-xs")}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {options.length ? (
        <Field label={kind === "labour" ? "From your services" : "From your parts"} htmlFor="pick" hint="Optional — fills in the description and price">
          <Select
            id="pick"
            value={pick}
            onChange={(e) => {
              const chosen = options.find((o) => o.id === e.currentTarget.value);
              setPick(e.currentTarget.value);
              if (chosen) {
                setDescription(chosen.name);
                setPrice(String(chosen.price));
              }
            }}
          >
            <option value="">Custom {kind === "labour" ? "service" : "part"}…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} — {formatMoney(o.price, currency)}
                {o.detail ? ` (${o.detail})` : ""}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[3fr_1fr_1.3fr_1.2fr]">
        <Field label="Description" htmlFor="description" error={err("description")}>
          <Input id="description" name="description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        </Field>
        <Field label="Qty" htmlFor="quantity" error={err("quantity")}>
          <Input id="quantity" name="quantity" inputMode="decimal" defaultValue={state?.values?.quantity ?? "1"} />
        </Field>
        <Field label="Unit price" htmlFor="unitPrice" error={err("unitPrice")}>
          <Input id="unitPrice" name="unitPrice" inputMode="decimal" value={price} onChange={(e) => setPrice(e.currentTarget.value)} />
        </Field>
        <Field label="Discount" htmlFor="discount" hint="Amount" error={err("discount")}>
          <Input id="discount" name="discount" inputMode="decimal" defaultValue={state?.values?.discount ?? ""} />
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="Reason for this line" htmlFor="source">
          <Select id="source" name="source" defaultValue="customer_request" className="w-auto">
            <option value="customer_request">Customer asked for it</option>
            <option value="recommendation">We recommend it</option>
          </Select>
        </Field>
        <Field label="Related to" htmlFor="inspectionCategory" hint="Optional">
          <Select id="inspectionCategory" name="inspectionCategory" defaultValue="" className="w-auto">
            <option value="">—</option>
            {INSPECTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="taxable" defaultChecked className="size-4 rounded border-slate-300" />
          Taxable
        </label>
        <div className="mb-0.5 ml-auto">
          <SubmitButton pendingText="Adding…">Add line</SubmitButton>
        </div>
      </div>
    </>
  );
}

export function LineEditor({
  lineId,
  jobId,
  defaults,
}: {
  lineId: string;
  jobId: string;
  defaults: { description: string; quantity: string; unitPrice: string; discount: string; taxable: boolean };
}) {
  const [state, action] = useActionState(updateLine, undefined);
  const [removeState, remove] = useActionState(removeLine, undefined);
  const err = (n: string) => fieldError(state, n);
  const v = { ...defaults, ...(state?.values ?? {}) };

  return (
    <div className="flex items-center gap-1">
      <details>
        <summary className="cursor-pointer list-none rounded px-1.5 py-0.5 text-xs text-brand-700 hover:bg-brand-50">Edit</summary>
        <form action={action} className="absolute right-4 z-10 mt-2 w-80 space-y-3 rounded-md bg-white p-4 text-left shadow-lg ring-1 ring-slate-200 sm:w-96">
          <input type="hidden" name="lineId" value={lineId} />
          <input type="hidden" name="jobId" value={jobId} />
          <FormMessage state={state} />
          <Field label="Description" htmlFor={`d-${lineId}`} error={err("description")}>
            <Input id={`d-${lineId}`} name="description" defaultValue={v.description} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Qty" htmlFor={`q-${lineId}`} error={err("quantity")}>
              <Input id={`q-${lineId}`} name="quantity" defaultValue={v.quantity} inputMode="decimal" />
            </Field>
            <Field label="Price" htmlFor={`p-${lineId}`} error={err("unitPrice")}>
              <Input id={`p-${lineId}`} name="unitPrice" defaultValue={v.unitPrice} inputMode="decimal" />
            </Field>
            <Field label="Discount" htmlFor={`x-${lineId}`} error={err("discount")}>
              <Input id={`x-${lineId}`} name="discount" defaultValue={v.discount} inputMode="decimal" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="taxable" defaultChecked={defaults.taxable} className="size-4 rounded border-slate-300" />
            Taxable
          </label>
          <SubmitButton variant="secondary" className="w-full">
            Save line
          </SubmitButton>
        </form>
      </details>
      <form action={remove}>
        <input type="hidden" name="lineId" value={lineId} />
        <input type="hidden" name="jobId" value={jobId} />
        <SubmitButton variant="ghost" pendingText="…" className="px-1.5 py-0.5 text-xs text-red-700">
          {removeState?.error ? "Retry" : "Remove"}
        </SubmitButton>
      </form>
    </div>
  );
}

export function DetailsForm({
  estimateId,
  jobId,
  defaults,
}: {
  estimateId: string;
  jobId: string;
  defaults: { estimatedCompletion: string; terms: string; customerNote: string };
}) {
  const [state, action] = useActionState(saveEstimateDetails, undefined);
  const v = { ...defaults, ...(state?.values ?? {}) };
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="estimateId" value={estimateId} />
      <input type="hidden" name="jobId" value={jobId} />
      <FormMessage state={state} />
      <Field label="Estimated completion" htmlFor="estimatedCompletion" hint="e.g. Tomorrow by 5 pm">
        <Input id="estimatedCompletion" name="estimatedCompletion" defaultValue={v.estimatedCompletion} maxLength={120} />
      </Field>
      <Field label="Note to the customer" htmlFor="customerNote" hint="Optional — shown on the approval page">
        <textarea id="customerNote" name="customerNote" rows={2} defaultValue={v.customerNote} maxLength={2000} className={textarea} />
      </Field>
      <Field label="Terms" htmlFor="terms" hint="Optional — e.g. warranty, validity, parts availability">
        <textarea id="terms" name="terms" rows={2} defaultValue={v.terms} maxLength={2000} className={textarea} />
      </Field>
      <SubmitButton variant="secondary">Save details</SubmitButton>
    </form>
  );
}

function LinkShare({ state, customerName, phone, vehicle, workshop }: { state: LinkState; customerName: string; phone: string; vehicle: string; workshop: string }) {
  const [copied, setCopied] = useState(false);
  if (!state.link) return null;
  const message = `Assalam-o-Alaikum ${customerName.split(" ")[0]}, here is the estimate for your ${vehicle} from ${workshop}. Please review and approve the work here: ${state.link}`;
  const wa = whatsappLink(phone, message);
  return (
    <div className="space-y-3 rounded-md bg-emerald-50 p-4 ring-1 ring-emerald-200">
      <p className="text-sm text-emerald-900">{state.success}</p>
      <Input readOnly value={state.link} aria-label="Approval link" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass("secondary")}
          onClick={async () => {
            await navigator.clipboard.writeText(state.link!);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
            Send on WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}

type ShareProps = { estimateId: string; jobId: string; customerName: string; phone: string; vehicle: string; workshop: string };

// One panel for "send" (draft) and "new link" (sent). It stays mounted when sending
// refreshes the page into the waiting state, so the one-time link stays on screen.
export function SharePanel(props: ShareProps & { status: "draft" | "sent"; disabledReason?: string }) {
  const [sent, send] = useActionState(sendEstimate, undefined);
  const [renewed, renew] = useActionState(renewLink, undefined);
  const latest = renewed?.link ? renewed : sent;
  return (
    <div className="space-y-4">
      {latest?.link ? <LinkShare state={latest} {...props} /> : null}
      {props.status === "draft" ? (
        <SendForm {...props} state={sent} action={send} />
      ) : (
        <RenewForm {...props} state={renewed} action={renew} hasLink={Boolean(latest?.link)} />
      )}
    </div>
  );
}

function SendForm({
  state,
  action,
  ...props
}: ShareProps & { disabledReason?: string; state: LinkState | undefined; action: (fd: FormData) => void }) {
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="estimateId" value={props.estimateId} />
      <input type="hidden" name="jobId" value={props.jobId} />
      {state?.error ? <FormMessage state={state} /> : null}
      {props.disabledReason ? <p className="text-sm text-slate-600">{props.disabledReason}</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Link valid for" htmlFor="validDays">
          <Select id="validDays" name="validDays" defaultValue="7" className="w-auto">
            {[3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </Field>
        <div className={props.disabledReason ? "pointer-events-none opacity-50" : undefined}>
          <SubmitButton pendingText="Sending…">Send to customer</SubmitButton>
        </div>
      </div>
      <p className="text-xs text-slate-500">Sending freezes this version. To change it afterwards you&apos;ll create a revision, which the customer approves again.</p>
    </form>
  );
}

function RenewForm({
  state,
  action,
  hasLink,
  ...props
}: ShareProps & { state: LinkState | undefined; action: (fd: FormData) => void; hasLink: boolean }) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="estimateId" value={props.estimateId} />
      <input type="hidden" name="jobId" value={props.jobId} />
      <input type="hidden" name="validDays" value="7" />
      {state?.error ? <FormMessage state={state} /> : null}
      <SubmitButton variant="secondary" pendingText="Creating…">
        Get a new link
      </SubmitButton>
      <span className="text-xs text-slate-500">
        {hasLink
          ? "Only needed if the link is lost — a new link replaces this one."
          : "For security the link is only shown once. A new link replaces the old one."}
      </span>
    </form>
  );
}

export function DecisionForm({
  estimateId,
  jobId,
  lines,
  currency,
}: {
  estimateId: string;
  jobId: string;
  lines: { id: string; description: string; total: number }[];
  currency: string;
}) {
  const [state, action] = useActionState(recordDecision, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="estimateId" value={estimateId} />
      <input type="hidden" name="jobId" value={jobId} />
      <FormMessage state={state} />
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Lines the customer approved</legend>
        <div className="mt-2 space-y-1.5">
          {lines.map((l) => (
            <label key={l.id} className="flex items-center justify-between gap-3 text-sm text-slate-700">
              <span className="flex items-center gap-2">
                <input type="checkbox" name="approved" value={l.id} defaultChecked className="size-4 rounded border-slate-300" />
                {l.description}
              </span>
              <span className="tabular-nums text-slate-500">{formatMoney(l.total, currency)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <Field label="How did they tell you?" htmlFor="method">
          <Select id="method" name="method" defaultValue="phone">
            <option value="phone">Phone call</option>
            <option value="in_person">In person</option>
            <option value="whatsapp">WhatsApp message</option>
          </Select>
        </Field>
        <Field label="Note" htmlFor="note" hint="Optional">
          <Input id="note" name="note" maxLength={500} />
        </Field>
      </div>
      <SubmitButton variant="secondary" pendingText="Recording…">
        Record decision
      </SubmitButton>
      <p className="text-xs text-slate-500">Untick everything to record that the customer declined. The decision is logged under your name.</p>
    </form>
  );
}

export function ReviseForm({ jobId, needsReason, label }: { jobId: string; needsReason: boolean; label: string }) {
  const [state, action] = useActionState(createEstimate, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      {state?.error ? <FormMessage state={state} /> : null}
      {needsReason ? (
        <Field label="Why is the estimate changing?" htmlFor="reason" hint="Shown on the job timeline" error={fieldError(state, "reason")}>
          <textarea id="reason" name="reason" rows={2} maxLength={500} className={textarea} placeholder="e.g. Customer asked to add wheel alignment" />
        </Field>
      ) : null}
      <SubmitButton variant={needsReason ? "secondary" : "primary"} pendingText="Starting…">
        {label}
      </SubmitButton>
    </form>
  );
}

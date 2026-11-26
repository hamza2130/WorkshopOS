"use client";

import { useActionState, useId, useState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { buttonClass, cx, Field, Input, Select } from "@/components/ui";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/invoices";
import {
  addInvoiceLine,
  issueInvoice,
  recordPayment,
  refundPayment,
  removeInvoiceLine,
  saveInvoiceNotes,
  updateInvoiceLine,
  voidInvoice,
} from "../actions";

export type CataloguePart = { id: string; name: string; partNumber: string | null; price: number; label: string };

const textarea =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 aria-invalid:border-red-500";

export function AddLineForm({ invoiceId, parts }: { invoiceId: string; parts: CataloguePart[] }) {
  const [state, action] = useActionState(addInvoiceLine, undefined);
  const [kind, setKind] = useState<"labour" | "part" | "other">("labour");
  const [picked, setPicked] = useState<CataloguePart | null>(null);
  const v = state?.values;

  return (
    <form key={state?.nonce} action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="partId" value={picked?.id ?? ""} />
      <input type="hidden" name="partNumber" value={picked?.partNumber ?? ""} />
      <FormMessage state={state} />
      <div className="flex gap-1.5" role="group" aria-label="Line type">
        {(["labour", "part", "other"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setPicked(null);
            }}
            className={buttonClass(kind === k ? "primary" : "secondary", "px-2.5 py-1 text-xs")}
          >
            {k === "labour" ? "Labour" : k === "part" ? "Part" : "Other"}
          </button>
        ))}
      </div>
      {kind === "part" && parts.length ? (
        <Field label="From your parts" htmlFor="catalogue" hint="Optional — fills in the description and price">
          <Select
            id="catalogue"
            value={picked?.id ?? ""}
            onChange={(e) => setPicked(parts.find((p) => p.id === e.currentTarget.value) ?? null)}
          >
            <option value="">Custom part…</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_80px_120px_110px]">
        <Field label="Description" htmlFor="line-description" error={fieldError(state, "description")}>
          <Input id="line-description" name="description" key={picked?.id ?? "custom"} defaultValue={picked?.name ?? v?.description} maxLength={300} required />
        </Field>
        <Field label="Qty" htmlFor="line-quantity" error={fieldError(state, "quantity")}>
          <Input id="line-quantity" name="quantity" defaultValue={v?.quantity ?? "1"} inputMode="decimal" required />
        </Field>
        <Field label="Unit price" htmlFor="line-price" error={fieldError(state, "unitPrice")}>
          <Input id="line-price" name="unitPrice" key={`p${picked?.id ?? ""}`} defaultValue={picked ? String(picked.price) : v?.unitPrice} inputMode="decimal" required />
        </Field>
        <Field label="Discount" htmlFor="line-discount" error={fieldError(state, "discount")}>
          <Input id="line-discount" name="discount" defaultValue={v?.discount} inputMode="decimal" placeholder="Amount" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="taxable" defaultChecked className="size-4 rounded border-slate-300" /> Taxable
        </label>
        <SubmitButton pendingText="Adding…">Add line</SubmitButton>
      </div>
      <p className="text-xs text-slate-500">Lines added here weren&apos;t on the estimate the customer approved, and are marked that way.</p>
    </form>
  );
}

/** One tap to bill a part the mechanic used that wasn't on the approved estimate. */
export function AddPartUsedLine({
  invoiceId,
  description,
  quantity,
  partId,
  partNumber,
  price,
}: {
  invoiceId: string;
  description: string;
  quantity: number;
  partId: string | null;
  partNumber: string | null;
  price: number | null;
}) {
  const [state, action] = useActionState(addInvoiceLine, undefined);
  const [unitPrice, setUnitPrice] = useState(price != null ? String(price) : "");
  const id = useId();
  if (state?.success) return <span className="text-xs text-emerald-700">Added</span>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="kind" value="part" />
      <input type="hidden" name="source" value="parts_used" />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="quantity" value={String(quantity)} />
      <input type="hidden" name="partId" value={partId ?? ""} />
      <input type="hidden" name="partNumber" value={partNumber ?? ""} />
      <input type="hidden" name="taxable" value="on" />
      <label className="sr-only" htmlFor={id}>
        Unit price for {description}
      </label>
      <Input
        id={id}
        name="unitPrice"
        value={unitPrice}
        onChange={(e) => setUnitPrice(e.currentTarget.value)}
        inputMode="decimal"
        placeholder="Unit price"
        className="w-28 py-1.5"
        required
      />
      <SubmitButton variant="secondary" pendingText="Adding…" className="py-1.5">
        Add to invoice
      </SubmitButton>
      {state?.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

export function LineEditor({
  invoiceId,
  line,
}: {
  invoiceId: string;
  line: { id: string; description: string; quantity: number; unitPrice: number; discount: number; taxable: boolean };
}) {
  // Open while the last opening is newer than the last successful save.
  const [openedAt, setOpenedAt] = useState(0);
  const [state, action] = useActionState(updateInvoiceLine, undefined);
  const [removeState, remove] = useActionState(removeInvoiceLine, undefined);
  const v = state?.values;
  const open = openedAt > (state?.nonce ?? 0);
  const setOpen = (o: boolean) => setOpenedAt(o ? Date.now() : 0);

  if (!open) {
    return (
      <div className="flex justify-end gap-1">
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("ghost", "px-2 py-1 text-xs")}>
          Edit
        </button>
        <form action={remove}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="lineId" value={line.id} />
          <SubmitButton variant="ghost" pendingText="…" className="px-2 py-1 text-xs text-red-700">
            Remove
          </SubmitButton>
        </form>
        {removeState?.error ? <span className="text-xs text-red-700">{removeState.error}</span> : null}
      </div>
    );
  }
  return (
    <form key={state?.nonce} action={action} className="mt-2 space-y-2 rounded-md bg-slate-50 p-3 text-left ring-1 ring-slate-200">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="lineId" value={line.id} />
      <input type="hidden" name="kind" value="other" />
      <input type="hidden" name="partId" value="" />
      {state?.error ? <FormMessage state={state} /> : null}
      <Input name="description" aria-label="Description" defaultValue={v?.description ?? line.description} maxLength={300} required />
      <div className="grid grid-cols-3 gap-2">
        <Input name="quantity" aria-label="Quantity" defaultValue={v?.quantity ?? String(line.quantity)} inputMode="decimal" />
        <Input name="unitPrice" aria-label="Unit price" defaultValue={v?.unitPrice ?? String(line.unitPrice)} inputMode="decimal" />
        <Input name="discount" aria-label="Discount" defaultValue={v?.discount ?? (line.discount ? String(line.discount) : "")} placeholder="Discount" inputMode="decimal" />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input type="checkbox" name="taxable" defaultChecked={line.taxable} className="size-4 rounded border-slate-300" /> Taxable
      </label>
      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…" className="py-1.5">
          Save
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "py-1.5")}>
          Close
        </button>
      </div>
    </form>
  );
}

export function NotesForm({ invoiceId, notes }: { invoiceId: string; notes: string }) {
  const [state, action] = useActionState(saveInvoiceNotes, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <label htmlFor="notes" className="block text-sm font-medium text-slate-800">
        Notes printed on the invoice
      </label>
      <textarea id="notes" name="notes" rows={2} maxLength={1000} defaultValue={state?.values?.notes ?? notes} placeholder="e.g. 3-month warranty on brake pads" className={textarea} />
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary" pendingText="Saving…" className="py-1.5">
          Save notes
        </SubmitButton>
        {state?.success ? <span className="text-xs text-emerald-700">{state.success}</span> : null}
        {state?.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
      </div>
    </form>
  );
}

export function IssueForm({ invoiceId, total }: { invoiceId: string; total: string }) {
  const [state, action] = useActionState(issueInvoice, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Issuing…">Issue invoice · {total}</SubmitButton>
      <p className="text-xs text-slate-500">
        Issuing gives it the next invoice number and freezes it. To change it afterwards you void it and make a new one.
      </p>
    </form>
  );
}

export function PaymentForm({ invoiceId, balance }: { invoiceId: string; balance: number }) {
  const [state, action] = useActionState(recordPayment, undefined);
  const v = state?.values;
  return (
    <form key={state?.nonce} action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount received" htmlFor="pay-amount" error={fieldError(state, "amount")} hint="Full balance filled in; change it for a part payment.">
          <Input id="pay-amount" name="amount" defaultValue={v?.amount ?? String(balance)} inputMode="decimal" required />
        </Field>
        <Field label="Method" htmlFor="pay-method" error={fieldError(state, "method")}>
          <Select id="pay-method" name="method" defaultValue={v?.method ?? "cash"}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference" htmlFor="pay-reference" hint="Optional — transaction ID, cheque number">
          <Input id="pay-reference" name="reference" defaultValue={v?.reference} maxLength={120} />
        </Field>
        <Field label="Note" htmlFor="pay-note" hint="Optional">
          <Input id="pay-note" name="note" defaultValue={v?.note} maxLength={500} />
        </Field>
      </div>
      <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
    </form>
  );
}

export function RefundForm({ invoiceId, paymentId, max }: { invoiceId: string; paymentId: string; max: number }) {
  // Open while the last opening is newer than the last successful refund, so it can be opened again.
  const [openedAt, setOpenedAt] = useState(0);
  const [state, action] = useActionState(refundPayment, undefined);
  const open = openedAt > (state?.nonce ?? 0);
  const setOpen = (o: boolean) => setOpenedAt(o ? Date.now() : 0);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("ghost", "px-2 py-1 text-xs")}>
        Refund…
      </button>
    );
  }
  const v = state?.values;
  return (
    <form action={action} className={cx("mt-2 space-y-2 rounded-md bg-slate-50 p-3 text-left ring-1 ring-slate-200")}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      {state?.error ? <FormMessage state={state} /> : null}
      <div className="grid grid-cols-2 gap-2">
        <Input name="amount" aria-label="Amount to refund" defaultValue={v?.amount ?? String(max)} inputMode="decimal" />
        <Select name="method" aria-label="Refund method" defaultValue={v?.method ?? "cash"}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
      </div>
      <textarea name="reason" aria-label="Reason" rows={2} required maxLength={500} defaultValue={v?.reason} placeholder="Why is money going back? Also use this to correct a payment entered by mistake." className={textarea} />
      <div className="flex gap-2">
        <SubmitButton variant="danger" pendingText="Saving…" className="py-1.5">
          Record refund
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "py-1.5")}>
          Back
        </button>
      </div>
    </form>
  );
}

export function VoidForm({ invoiceId, blocked }: { invoiceId: string; blocked: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(voidInvoice, undefined);
  if (blocked) return <p className="text-sm text-slate-600">{blocked}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("danger")}>
        Void invoice…
      </button>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {state?.error ? <FormMessage state={state} /> : null}
      <label htmlFor="void-reason" className="block text-sm font-medium text-slate-800">
        Why is this invoice being voided?
      </label>
      <textarea
        id="void-reason"
        name="reason"
        rows={2}
        required
        autoFocus
        maxLength={500}
        aria-invalid={Boolean(fieldError(state, "reason"))}
        defaultValue={state?.values?.reason}
        placeholder="e.g. Billed to the wrong customer"
        className={textarea}
      />
      <p className="text-xs text-slate-500">The invoice and its number stay on record, marked void, with your name and this reason.</p>
      <div className="flex gap-2">
        <SubmitButton variant="danger" pendingText="Voiding…">
          Confirm void
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
          Back
        </button>
      </div>
    </form>
  );
}

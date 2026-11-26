import { z } from "zod";
import { moneyField, quantityField, textField } from "./estimates";
import type { Database } from "./supabase/database.types";

type Enums = Database["public"]["Enums"];
export type InvoiceStatus = Enums["invoice_status"];
export type PaymentMethod = Enums["payment_method"];
export type PaymentKind = Enums["payment_kind"];
export type InvoiceLineSource = Enums["invoice_line_source"];

/** Jobs at these stages can be billed: the work is done or being checked. */
export const BILLABLE_STAGES = ["quality_check", "ready_for_delivery", "delivered"] as const;

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "bank_transfer", "jazzcash", "easypaisa", "card", "cheque", "other"];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  card: "Card",
  cheque: "Cheque",
  other: "Other",
};

export const LINE_SOURCE_LABELS: Record<InvoiceLineSource, string> = {
  approved_estimate: "Approved estimate",
  parts_used: "Part used, not on estimate",
  added: "Added at billing",
};

/** What the customer owes, in words the front desk uses. */
export type PaymentState = "draft" | "unpaid" | "part_paid" | "paid" | "void";

export function paymentState(status: InvoiceStatus, total: number, amountPaid: number): PaymentState {
  if (status === "draft" || status === "void") return status;
  if (amountPaid <= 0 && total > 0) return "unpaid";
  if (amountPaid < total) return "part_paid";
  return "paid";
}

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  draft: "Draft",
  unpaid: "Unpaid",
  part_paid: "Part paid",
  paid: "Paid",
  void: "Void",
};

export const PAYMENT_STATE_TONES: Record<PaymentState, "neutral" | "success" | "warning" | "muted"> = {
  draft: "muted",
  unpaid: "warning",
  part_paid: "warning",
  paid: "success",
  void: "muted",
};

/** List tabs on /invoices. */
export const INVOICE_VIEWS = {
  unpaid: { label: "Unpaid" },
  draft: { label: "Drafts" },
  paid: { label: "Paid" },
  void: { label: "Void" },
  all: { label: "All" },
} as const;
export type InvoiceView = keyof typeof INVOICE_VIEWS;

export const invoiceLineSchema = z
  .object({
    kind: z.enum(["labour", "part", "other"]),
    description: textField(300).pipe(z.string().min(1, "Describe the work or part.")),
    partId: textField(40).pipe(z.union([z.literal("").transform(() => null), z.uuid()])),
    quantity: quantityField,
    unitPrice: moneyField("a price"),
    discount: moneyField("a discount", false).transform((v) => v ?? 0),
    taxable: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
  })
  .refine((v) => v.discount <= Math.round(v.quantity * (v.unitPrice ?? 0) * 100) / 100, {
    path: ["discount"],
    message: "The discount can't be more than the line amount.",
  });

export const paymentSchema = z.object({
  invoiceId: z.uuid(),
  amount: moneyField("the amount received").refine((v) => v === null || v > 0, "Enter an amount above zero."),
  method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]], { error: "Choose how they paid." }),
  reference: textField(120).transform((v) => v || null),
  note: textField(500).transform((v) => v || null),
});

export const refundSchema = z.object({
  invoiceId: z.uuid(),
  paymentId: z.uuid(),
  amount: moneyField("the amount to refund").refine((v) => v === null || v > 0, "Enter an amount above zero."),
  method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]], { error: "Choose how the money goes back." }),
  reason: textField(500).pipe(z.string().min(3, "Say why the money is going back.")),
});

export const voidSchema = z.object({
  invoiceId: z.uuid(),
  reason: textField(500).pipe(z.string().min(3, "Say why this invoice is being voided.")),
});

/** Database error codes → what the person at the desk should read. */
export const INVOICE_ERRORS: Record<string, string> = {
  invoice_exists: "This job already has an invoice.",
  invoice_not_allowed: "Invoices are made once the work is done (quality check or later).",
  invoice_not_draft: "This invoice has already been issued.",
  invoice_empty: "Add at least one line before issuing.",
  invoice_locked: "Issued invoices can't be changed. Void it and make a new one if it's wrong.",
  invoice_void: "This invoice is already void.",
  invoice_has_payments: "Money has been received on this invoice. Refund the payments before voiding it.",
  invoice_not_issued: "Payments are taken against issued invoices.",
  invoice_permanent: "Invoices are never deleted. Void it instead.",
  overpayment: "That's more than the balance due.",
  refund_too_large: "That's more than is left of this payment to refund.",
  amount_invalid: "Enter an amount above zero, with at most two decimals.",
  reason_required: "Give a reason.",
  invoice_required: "Issue the invoice before the vehicle is delivered.",
  invoice_open: "This job has an invoice. Void it before cancelling the job.",
};

export function invoiceError(error: { message: string; details?: string | null } | null, fallback: string) {
  if (!error) return fallback;
  if ((error.message === "overpayment" || error.message === "refund_too_large" || error.message === "invoice_not_allowed") && error.details) {
    return error.details;
  }
  return INVOICE_ERRORS[error.message] ?? fallback;
}

/** Click-to-WhatsApp text for an issued invoice. */
export function invoiceMessage(p: {
  customerName: string;
  workshopName: string;
  invoiceNumber: string;
  vehicle: string;
  total: string;
  balance: string;
  paid: boolean;
}) {
  const first = p.customerName.split(" ")[0] || p.customerName;
  return p.paid
    ? `Assalam-o-Alaikum ${first}, thank you for your payment. Invoice ${p.invoiceNumber} for your ${p.vehicle} (${p.total}) is fully paid. — ${p.workshopName}`
    : `Assalam-o-Alaikum ${first}, your ${p.vehicle} invoice ${p.invoiceNumber} from ${p.workshopName} is ${p.total}. Balance due: ${p.balance}.`;
}

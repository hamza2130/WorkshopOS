import { z } from "zod";
import { parseMoney } from "./money";
import type { Database } from "./supabase/database.types";

type Enums = Database["public"]["Enums"];
export type EstimateStatus = Enums["estimate_status"];
export type InspectionCategory = Enums["inspection_category"];
export type InspectionOutcome = Enums["inspection_outcome"];
export type ItemKind = Enums["estimate_item_kind"];
export type ItemSource = Enums["estimate_item_source"];
export type ApprovalStatus = Enums["approval_status"];
export type DecisionMethod = Enums["decision_method"];

export const INSPECTION_CATEGORIES: readonly InspectionCategory[] = [
  "engine",
  "transmission",
  "brakes",
  "suspension",
  "steering",
  "electrical",
  "battery",
  "tyres",
  "cooling",
  "air_conditioning",
  "fluids",
  "exterior",
  "interior",
];

export const CATEGORY_LABELS: Record<InspectionCategory, string> = {
  engine: "Engine",
  transmission: "Transmission",
  brakes: "Brakes",
  suspension: "Suspension",
  steering: "Steering",
  electrical: "Electrical system",
  battery: "Battery",
  tyres: "Tyres",
  cooling: "Cooling system",
  air_conditioning: "Air conditioning",
  fluids: "Fluids",
  exterior: "Exterior",
  interior: "Interior",
};

export const OUTCOMES: readonly InspectionOutcome[] = ["normal", "needs_attention", "requires_repair", "not_inspected"];
export const OUTCOME_LABELS: Record<InspectionOutcome, string> = {
  normal: "Normal",
  needs_attention: "Needs attention",
  requires_repair: "Requires repair",
  not_inspected: "Not inspected",
};
export const OUTCOME_TONES: Record<InspectionOutcome, "success" | "warning" | "neutral" | "muted"> = {
  normal: "success",
  needs_attention: "warning",
  requires_repair: "warning",
  not_inspected: "muted",
};

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: "Draft",
  sent: "Waiting for customer",
  approved: "Approved",
  partially_approved: "Partly approved",
  rejected: "Declined",
  withdrawn: "Withdrawn",
  superseded: "Replaced by a newer version",
};
export const ESTIMATE_STATUS_TONES: Record<EstimateStatus, "success" | "warning" | "neutral" | "muted"> = {
  draft: "muted",
  sent: "warning",
  approved: "success",
  partially_approved: "success",
  rejected: "muted",
  withdrawn: "muted",
  superseded: "muted",
};

export const KIND_LABELS: Record<ItemKind, string> = { labour: "Labour", part: "Part", other: "Other" };
export const SOURCE_LABELS: Record<ItemSource, string> = {
  customer_request: "Customer request",
  recommendation: "Our recommendation",
};
export const APPROVAL_LABELS: Record<ApprovalStatus, string> = { pending: "Pending", approved: "Approved", declined: "Declined" };
export const METHOD_LABELS: Record<DecisionMethod, string> = {
  link: "approval link",
  in_person: "in person",
  phone: "phone",
  whatsapp: "WhatsApp",
};

// Validation -----------------------------------------------------------------

const text = (max: number) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .pipe(z.string().max(max, `Use at most ${max} characters.`));
const optionalText = (max: number) => text(max).transform((v) => (v === "" ? null : v));

const money = (label: string, required = true) =>
  text(20)
    .transform(parseMoney)
    .refine((v) => (required ? v !== null : true), `Enter ${label}.`)
    .refine((v) => v === null || !Number.isNaN(v), `Enter ${label} as a number, e.g. 1500 or 1,500.50.`);

const quantity = text(12)
  .refine((v) => /^\d{1,6}(\.\d{1,2})?$/.test(v), "Enter a quantity like 1 or 2.5.")
  .transform(Number)
  .refine((v) => v > 0, "Quantity must be more than 0.");

// Shared with invoice lines and payments (src/lib/invoices.ts).
export { text as textField, money as moneyField, quantity as quantityField };

export const lineSchema = z
  .object({
    kind: z.enum(["labour", "part", "other"]),
    source: z.enum(["customer_request", "recommendation"]).default("customer_request"),
    inspectionCategory: text(30).pipe(z.union([z.literal("").transform(() => null), z.enum(INSPECTION_CATEGORIES as [InspectionCategory, ...InspectionCategory[]])])),
    description: text(300).pipe(z.string().min(1, "Describe the work or part.")),
    labourItemId: text(40).pipe(z.union([z.literal("").transform(() => null), z.uuid()])),
    partId: text(40).pipe(z.union([z.literal("").transform(() => null), z.uuid()])),
    quantity,
    unitPrice: money("a price"),
    discount: money("a discount", false).transform((v) => v ?? 0),
    taxable: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
  })
  .refine((v) => v.discount <= Math.round(v.quantity * (v.unitPrice ?? 0) * 100) / 100, {
    path: ["discount"],
    message: "The discount can't be more than the line amount.",
  });

export const labourSchema = z.object({
  name: text(120).pipe(z.string().min(2, "Name the service.")),
  description: optionalText(500),
  defaultPrice: money("a price"),
  estimatedMinutes: text(6)
    .refine((v) => v === "" || /^\d+$/.test(v), "Minutes, digits only.")
    .transform((v) => (v === "" ? null : Number(v))),
});

export const partSchema = z.object({
  name: text(120).pipe(z.string().min(2, "Name the part.")),
  partNumber: optionalText(60),
  brand: optionalText(60),
  category: optionalText(60),
  supplier: optionalText(120),
  costPrice: money("a cost price", false),
  sellingPrice: money("a selling price"),
  unit: text(20).transform((v) => v || "piece"),
});

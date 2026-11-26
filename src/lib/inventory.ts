import { z } from "zod";
import { moneyField, textField } from "./estimates";
import type { Database } from "./supabase/database.types";

export type MovementKind = Database["public"]["Enums"]["stock_movement_kind"];

export const MOVEMENT_LABELS: Record<MovementKind, string> = {
  receipt: "Received",
  consumption: "Used on job",
  return: "Back from job",
  adjustment: "Count correction",
};

/** "2", "0.5", "-3" — quantities without trailing zeros. */
export function formatQty(n: number | string | null | undefined) {
  return Number(n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

export type StockLevel = "untracked" | "negative" | "out" | "low" | "ok";

export function stockLevel(p: { track_stock: boolean; stock_on_hand: number; reorder_level: number | null }): StockLevel {
  if (!p.track_stock) return "untracked";
  if (p.stock_on_hand < 0) return "negative";
  if (p.stock_on_hand === 0) return "out";
  if (p.reorder_level != null && p.stock_on_hand <= p.reorder_level) return "low";
  return "ok";
}

export const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
  untracked: "Not tracked",
  negative: "Below zero",
  out: "Out of stock",
  low: "Low",
  ok: "In stock",
};

export const STOCK_LEVEL_TONES: Record<StockLevel, "neutral" | "success" | "warning" | "muted"> = {
  untracked: "muted",
  negative: "warning",
  out: "warning",
  low: "warning",
  ok: "success",
};

export const INVENTORY_VIEWS = {
  all: { label: "All parts" },
  low: { label: "Low or out" },
  untracked: { label: "Not tracked" },
} as const;
export type InventoryView = keyof typeof INVENTORY_VIEWS;

const quantity = (max: number, allowZero: boolean) =>
  textField(12)
    .refine((v) => /^\d{1,7}(\.\d{1,2})?$/.test(v.replace(/,/g, "")), "Enter a quantity like 10 or 2.5.")
    .transform((v) => Number(v.replace(/,/g, "")))
    .refine((v) => (allowZero ? v >= 0 : v > 0) && v <= max, allowZero ? "Enter 0 or more." : "Enter a quantity above zero.");

export const receiveSchema = z.object({
  partId: z.uuid(),
  quantity: quantity(100000, false),
  unitCost: moneyField("the cost", false),
  supplier: textField(120).transform((v) => v || null),
  reference: textField(120).transform((v) => v || null),
});

export const countSchema = z.object({
  partId: z.uuid(),
  counted: quantity(1000000, true),
  reason: textField(500).pipe(z.string().min(3, "Say why the stock is being corrected, e.g. monthly count.")),
});

export const stockSettingsSchema = z.object({
  partId: z.uuid(),
  trackStock: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  reorderLevel: textField(12)
    .refine((v) => v === "" || /^\d{1,7}(\.\d{1,2})?$/.test(v), "Enter a number like 5, or leave it empty.")
    .transform((v) => (v === "" ? null : Number(v))),
  location: textField(60).transform((v) => v || null),
});

export const STOCK_ERRORS: Record<string, string> = {
  stock_not_tracked: "Turn on stock tracking for this part first.",
  quantity_invalid: "Enter a quantity above zero, with at most two decimals.",
  cost_invalid: "Enter the cost as a number, e.g. 650.",
  reason_required: "Say why the stock is being corrected.",
  stock_direct_edit: "Stock can only change by receiving, counting or using parts.",
};

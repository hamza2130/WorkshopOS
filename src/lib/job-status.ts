import type { Database } from "./supabase/database.types";

export type JobStatus = Database["public"]["Enums"]["job_status"];
export type FuelLevel = Database["public"]["Enums"]["fuel_level"];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  awaiting_inspection: "Awaiting inspection",
  awaiting_estimate: "Awaiting estimate",
  awaiting_approval: "Awaiting customer approval",
  approved: "Approved",
  awaiting_assignment: "Awaiting assignment",
  in_progress: "In progress",
  on_hold: "On hold",
  quality_check: "Quality check",
  ready_for_delivery: "Ready for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export type StatusTone = "neutral" | "success" | "warning" | "muted";

export const JOB_STATUS_TONES: Record<JobStatus, StatusTone> = {
  draft: "muted",
  awaiting_inspection: "neutral",
  awaiting_estimate: "neutral",
  awaiting_approval: "warning",
  approved: "neutral",
  awaiting_assignment: "neutral",
  in_progress: "neutral",
  on_hold: "warning",
  quality_check: "neutral",
  ready_for_delivery: "success",
  delivered: "muted",
  cancelled: "muted",
};

// Statuses where the vehicle is physically at the workshop.
export const IN_WORKSHOP: readonly JobStatus[] = [
  "awaiting_inspection",
  "awaiting_estimate",
  "awaiting_approval",
  "approved",
  "awaiting_assignment",
  "in_progress",
  "on_hold",
  "quality_check",
  "ready_for_delivery",
];

export const CLOSED: readonly JobStatus[] = ["delivered", "cancelled"];

export const JOB_VIEWS = {
  active: { label: "In workshop", statuses: IN_WORKSHOP },
  draft: { label: "Drafts", statuses: ["draft"] },
  delivered: { label: "Delivered", statuses: ["delivered"] },
  cancelled: { label: "Cancelled", statuses: ["cancelled"] },
  all: { label: "All", statuses: null },
} as const satisfies Record<string, { label: string; statuses: readonly JobStatus[] | null }>;

export type JobView = keyof typeof JOB_VIEWS;

export function isJobStatus(value: string): value is JobStatus {
  return value in JOB_STATUS_LABELS;
}

export const FUEL_LEVELS: readonly FuelLevel[] = ["empty", "quarter", "half", "three_quarters", "full"];
export const FUEL_LEVEL_LABELS: Record<FuelLevel, string> = {
  empty: "Empty",
  quarter: "¼",
  half: "½",
  three_quarters: "¾",
  full: "Full",
};

// Timeline labels for history rows that weren't produced by a named action.
export const SYSTEM_ACTION_LABELS: Record<string, string> = {
  checked_in: "Checked in",
  created_as_draft: "Saved as draft",
  created: "Created",
};

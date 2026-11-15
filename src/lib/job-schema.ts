import { z } from "zod";
import { FUEL_LEVELS } from "./job-status";

const text = (max: number) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .pipe(z.string().max(max, `Use at most ${max} characters.`));

const optionalText = (max: number) => text(max).transform((v) => (v === "" ? null : v));

const fuelLevel = text(20).pipe(
  z.union([z.literal("").transform(() => null), z.enum(FUEL_LEVELS as [string, ...string[]]).transform((v) => v as (typeof FUEL_LEVELS)[number])]),
);

const localDateTime = text(16).refine(
  (v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v),
  "Choose a date and time.",
);

const jobFields = {
  complaint: text(4000).pipe(z.string().min(3, "Describe what the customer reported.")),
  observations: optionalText(4000),
  fuelLevel,
  advisorId: text(40).pipe(z.union([z.literal("").transform(() => null), z.uuid("Choose a service advisor.")])),
  expectedDelivery: localDateTime,
};

export const createJobSchema = z.object({
  ...jobFields,
  mileage: text(12)
    .refine((v) => v === "" || /^\d+$/.test(v), "Enter the odometer reading in km, digits only.")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || v <= 3_000_000, "That reading looks too high."),
  mileageNote: optionalText(300),
});

export const editJobSchema = z.object(jobFields);

export const statusChangeSchema = z.object({
  jobId: z.uuid(),
  action: z.string().regex(/^[a-z_]{2,40}$/),
  expectedStatus: z.string().regex(/^[a-z_]{2,40}$/),
  reason: optionalText(500),
});

export const noteSchema = z.object({
  jobId: z.uuid(),
  body: text(4000).pipe(z.string().min(1, "Write a note first.")),
  visibility: z.enum(["internal", "customer"]).default("internal"),
});

export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"] as const;
export const ATTACHMENT_CATEGORIES = ["vehicle_photo", "damage_photo", "document"] as const;
export const ATTACHMENT_CATEGORY_LABELS: Record<(typeof ATTACHMENT_CATEGORIES)[number], string> = {
  vehicle_photo: "Vehicle photo",
  damage_photo: "Existing damage",
  document: "Document",
};
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const attachmentSchema = z.object({
  jobId: z.uuid(),
  path: z.string().max(300),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(ATTACHMENT_TYPES),
  size: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),
  category: z.enum(ATTACHMENT_CATEGORIES),
});

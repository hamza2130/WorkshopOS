import { z } from "zod";

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const prefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{1,10}$/, "Use 1–10 letters, numbers or dashes.");

export const workshopSchema = z.object({
  name: z.string().trim().min(2, "Enter the workshop name.").max(120),
  phone: optionalText(30),
  email: z.union([z.literal("").transform(() => null), z.email("Enter a valid email address.").trim().toLowerCase()]),
  address: optionalText(300),
  city: optionalText(80),
  country: z.string().trim().toUpperCase().length(2, "Use a 2-letter country code, e.g. PK."),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. PKR."),
  timezone: z.string().trim().refine(isTimeZone, "Choose a valid time zone, e.g. Asia/Karachi."),
  taxLabel: z.string().trim().min(1, "Enter a tax label, e.g. GST.").max(20),
  taxRate: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a rate like 17 or 17.5 (up to 2 decimals).")
    .transform(Number)
    .refine((n) => n <= 100, "Tax can't exceed 100%."),
  invoicePrefix: prefix,
  jobCardPrefix: prefix,
});

export type WorkshopInput = z.infer<typeof workshopSchema>;

export const WORKSHOP_DEFAULTS = {
  country: "PK",
  currency: "PKR",
  timezone: "Asia/Karachi",
  taxLabel: "GST",
  taxRate: "0",
  invoicePrefix: "INV",
  jobCardPrefix: "JC",
};

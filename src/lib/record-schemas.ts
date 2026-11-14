import { z } from "zod";
import { isValidPhone, normalizeRegistration } from "./phone";

const text = (max: number) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .pipe(z.string().max(max, `Use at most ${max} characters.`));

const optionalText = (max: number) => text(max).transform((v) => (v === "" ? null : v));

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

const optionalInt = (min: number, max: number, label: string) =>
  text(12)
    .refine((v) => v === "" || /^\d+$/.test(v), "Enter a whole number.")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (v >= min && v <= max), `${label} must be between ${min} and ${max}.`);

const phone = text(30).refine(isValidPhone, "Enter a valid phone number, e.g. 0300 1234567.");

export const customerSchema = z
  .object({
    name: text(120).pipe(z.string().min(1, "Enter the customer's name.")),
    phone,
    whatsappSameAsPhone: checkbox,
    whatsapp: text(30),
    email: text(254).pipe(z.union([z.literal(""), z.email("Enter a valid email address.")])),
    address: optionalText(300),
    notes: optionalText(2000),
    confirmSharedPhone: checkbox,
  })
  .superRefine((v, ctx) => {
    if (!v.whatsappSameAsPhone && v.whatsapp && !isValidPhone(v.whatsapp)) {
      ctx.addIssue({ code: "custom", path: ["whatsapp"], message: "Enter a valid WhatsApp number." });
    }
  })
  .transform((v) => ({
    name: v.name,
    phone: v.phone,
    whatsapp: v.whatsappSameAsPhone ? v.phone : v.whatsapp || null,
    email: v.email === "" ? null : v.email.toLowerCase(),
    address: v.address,
    notes: v.notes,
    confirmSharedPhone: v.confirmSharedPhone,
  }));

export type CustomerInput = z.infer<typeof customerSchema>;

export const FUEL_TYPES = ["petrol", "diesel", "cng", "lpg", "hybrid", "electric", "other"] as const;
export const TRANSMISSIONS = ["manual", "automatic", "other"] as const;

export const FUEL_LABELS: Record<(typeof FUEL_TYPES)[number], string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  cng: "CNG",
  lpg: "LPG",
  hybrid: "Hybrid",
  electric: "Electric",
  other: "Other",
};

export const TRANSMISSION_LABELS: Record<(typeof TRANSMISSIONS)[number], string> = {
  manual: "Manual",
  automatic: "Automatic",
  other: "Other",
};

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  text(20).pipe(z.union([z.literal("").transform(() => null), z.enum(values)]));

export const vehicleSchema = z.object({
  registrationNumber: text(20).refine((v) => {
    const n = normalizeRegistration(v).length;
    return n >= 2 && n <= 15;
  }, "Enter the registration number, e.g. LEA-1234."),
  make: text(60).pipe(z.string().min(1, "Enter the make, e.g. Toyota.")),
  model: text(60).pipe(z.string().min(1, "Enter the model, e.g. Corolla.")),
  variant: optionalText(60),
  year: optionalInt(1950, new Date().getFullYear() + 1, "Year"),
  engineCc: optionalInt(50, 10000, "Engine capacity"),
  fuelType: optionalEnum(FUEL_TYPES),
  transmission: optionalEnum(TRANSMISSIONS),
  colour: optionalText(40),
  vin: optionalText(40).transform((v) => v?.toUpperCase() ?? null),
  engineNumber: optionalText(40).transform((v) => v?.toUpperCase() ?? null),
  notes: optionalText(2000),
  mileage: optionalInt(0, 3_000_000, "Mileage"),
  overrideReason: optionalText(300),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export const mileageSchema = z.object({
  reading: optionalInt(0, 3_000_000, "Mileage").refine((v) => v !== null, "Enter the odometer reading."),
  note: optionalText(300),
});

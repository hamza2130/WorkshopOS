// Mirrors public.normalize_phone() in the database; tests/rls checks they agree.
// Pakistan-first: 0300 1234567, +92 300 1234567 and 923001234567 are the same number.
export function normalizePhone(input: string | null | undefined): string | null {
  const d = (input ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0")) return `92${d.slice(1)}`;
  if (d.length === 10 && d.startsWith("3")) return `92${d}`;
  return d;
}

export function isValidPhone(input: string) {
  const n = normalizePhone(input);
  return n !== null && n.length >= 9 && n.length <= 15;
}

export function whatsappLink(phone: string, text?: string) {
  const n = normalizePhone(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

// Mirrors public.normalize_registration(): "LEA-1234", "lea 1234" and "LEA1234" match.
export function normalizeRegistration(input: string | null | undefined): string {
  return (input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

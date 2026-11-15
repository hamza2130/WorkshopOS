// Amounts arrive from Postgres numeric columns. Show whole rupees without decimals,
// and paisa only when present.
export function formatMoney(amount: number | string | null | undefined, currency = "PKR") {
  const n = Number(amount ?? 0);
  const whole = Math.round(n * 100) % 100 === 0;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** "1,250.50" or "1250.5" → 1250.5; null for blank; NaN-safe. Up to 2 decimal places. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

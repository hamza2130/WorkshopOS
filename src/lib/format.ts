// Timestamps are stored in UTC and always shown in the workshop's own time zone.
export function formatDateTime(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-PK", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

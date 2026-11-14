import { z } from "zod";

type SearchParams = Record<string, string | string[] | undefined>;

export function str(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function pageNumber(sp: SearchParams): number {
  const n = Number.parseInt(str(sp, "page"), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

export function isUuid(value: unknown): value is string {
  return z.uuid().safeParse(value).success;
}

export function withParams(path: string, params: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export const PAGE_SIZE = 25;

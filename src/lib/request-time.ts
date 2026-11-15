import "server-only";
import { cache } from "react";

// One clock reading per request, so every component in a render agrees on "now".
export const getRequestTime = cache(() => Date.now());

export function isOverdue(expected: string | null, closed: boolean, now: number) {
  return Boolean(expected) && !closed && new Date(expected!).getTime() < now;
}

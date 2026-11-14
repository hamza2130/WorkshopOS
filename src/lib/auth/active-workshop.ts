import "server-only";
import { cookies } from "next/headers";
import { ACTIVE_WORKSHOP_COOKIE } from "./session";

// Only a preference: getWorkshopContext() still verifies membership on every request.
export async function setActiveWorkshopCookie(workshopId: string) {
  (await cookies()).set(ACTIVE_WORKSHOP_COOKIE, workshopId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

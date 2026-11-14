"use client";

import { Select } from "@/components/ui";
import type { Membership } from "@/lib/auth/session";
import { switchWorkshop } from "./actions";

export function WorkshopSwitcher({ memberships, activeId }: { memberships: Membership[]; activeId: string }) {
  return (
    <form action={switchWorkshop}>
      <label htmlFor="workshopId" className="sr-only">
        Active workshop
      </label>
      <Select
        id="workshopId"
        name="workshopId"
        defaultValue={activeId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="max-w-56 py-1.5"
      >
        {memberships.map((m) => (
          <option key={m.workshopId} value={m.workshopId}>
            {m.workshopName}
          </option>
        ))}
      </Select>
    </form>
  );
}

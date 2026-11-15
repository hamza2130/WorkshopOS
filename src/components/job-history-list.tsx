import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { JobStatus } from "@/lib/job-status";
import { JobStatusBadge } from "./job-status-badge";

export type JobHistoryRow = {
  id: string;
  job_number: string;
  status: JobStatus;
  check_in_at: string;
  check_in_mileage: number | null;
  complaint: string;
  label?: string;
};

// Service history on vehicle and customer profiles: one row per job card, newest first.
export function JobHistoryList({ jobs, timeZone, empty }: { jobs: JobHistoryRow[]; timeZone: string; empty: string }) {
  if (!jobs.length) return <p className="px-6 py-4 text-sm text-slate-600">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {jobs.map((j) => (
        <li key={j.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-3">
          <div className="min-w-0">
            <p className="text-sm">
              <Link href={`/jobs/${j.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                {j.job_number}
              </Link>
              <span className="ml-2 text-slate-500">
                {formatDate(j.check_in_at, timeZone)}
                {j.label ? ` · ${j.label}` : ""}
                {j.check_in_mileage != null ? ` · ${j.check_in_mileage.toLocaleString("en-PK")} km` : ""}
              </span>
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm text-slate-700">{j.complaint}</p>
          </div>
          <JobStatusBadge status={j.status} />
        </li>
      ))}
    </ul>
  );
}

import { JOB_STATUS_LABELS, JOB_STATUS_TONES, type JobStatus } from "@/lib/job-status";
import { Badge } from "./ui";

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={JOB_STATUS_TONES[status]}>{JOB_STATUS_LABELS[status]}</Badge>;
}

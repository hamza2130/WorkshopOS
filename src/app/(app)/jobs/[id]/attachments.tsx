"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/form";
import { buttonClass, Select } from "@/components/ui";
import {
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_CATEGORY_LABELS,
  ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/job-schema";
import { createClient } from "@/lib/supabase/client";
import { recordAttachment, removeAttachment } from "../actions";

export type AttachmentItem = {
  id: string;
  url: string | null;
  fileName: string;
  contentType: string;
  category: (typeof ATTACHMENT_CATEGORIES)[number];
  caption: string;
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export function Attachments({
  jobId,
  workshopId,
  items,
  canEdit,
  canRemove = canEdit,
  defaultCategory = "vehicle_photo",
}: {
  jobId: string;
  workshopId: string;
  items: AttachmentItem[];
  /** Can add files. */
  canEdit: boolean;
  /** Can remove files (advisors only). */
  canRemove?: boolean;
  defaultCategory?: (typeof ATTACHMENT_CATEGORIES)[number];
}) {
  const router = useRouter();
  const [category, setCategory] = useState<(typeof ATTACHMENT_CATEGORIES)[number]>(defaultCategory);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function upload(files: FileList) {
    const supabase = createClient();
    const problems: string[] = [];
    const list = Array.from(files);
    for (const [i, file] of list.entries()) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
        problems.push(`${file.name}: only photos (JPEG, PNG, WebP, HEIC) and PDFs can be attached.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        problems.push(`${file.name}: larger than 10 MB.`);
        continue;
      }
      const path = `${workshopId}/${jobId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
      const { error } = await supabase.storage.from("job-attachments").upload(path, file, { contentType: file.type });
      if (error) {
        problems.push(`${file.name}: upload failed.`);
        continue;
      }
      const saved = await recordAttachment({
        jobId,
        path,
        fileName: file.name.slice(0, 200),
        contentType: file.type,
        size: file.size,
        category,
      });
      if (saved.error) problems.push(saved.error);
    }
    setBusy(null);
    setErrors(problems);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Type
            <Select value={category} onChange={(e) => setCategory(e.currentTarget.value as typeof category)} className="w-auto py-1.5">
              {ATTACHMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ATTACHMENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </label>
          <label className={buttonClass("secondary", busy ? "pointer-events-none opacity-60" : "cursor-pointer")}>
            {busy ?? "Add photos or files"}
            <input
              type="file"
              multiple
              accept={ATTACHMENT_TYPES.join(",")}
              className="sr-only"
              disabled={Boolean(busy)}
              onChange={(e) => {
                const files = e.currentTarget.files;
                if (files?.length) void upload(files);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <span className="text-xs text-slate-500">Up to 10 MB each. On a phone this opens the camera.</span>
        </div>
      ) : null}

      {errors.length ? (
        <ul role="alert" className="space-y-1 rounded-md bg-red-50 px-3.5 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      {items.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="group overflow-hidden rounded-md ring-1 ring-slate-200">
              <a href={item.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-slate-100">
                {item.url && item.contentType.startsWith("image/") && !item.contentType.includes("hei") ? (
                  // Signed, expiring URLs from private storage; next/image would cache them.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.fileName} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full items-center justify-center p-3 text-center text-xs font-medium text-slate-600">
                    {item.contentType === "application/pdf" ? "PDF" : "Photo"} · {item.fileName}
                  </span>
                )}
              </a>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="truncate text-xs text-slate-600" title={item.fileName}>
                  {ATTACHMENT_CATEGORY_LABELS[item.category]}
                </span>
                {canRemove ? <RemoveButton jobId={jobId} attachmentId={item.id} /> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">No photos or documents yet.</p>
      )}
    </div>
  );
}

function RemoveButton({ jobId, attachmentId }: { jobId: string; attachmentId: string }) {
  const [state, action] = useActionState(removeAttachment, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Remove this file from the job card? It stays in the job's history.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="attachmentId" value={attachmentId} />
      <SubmitButton variant="ghost" pendingText="…" className="px-1.5 py-0.5 text-xs">
        {state?.error ? "Retry" : "Remove"}
      </SubmitButton>
    </form>
  );
}

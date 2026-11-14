import Link from "next/link";
import { withParams } from "@/lib/params";
import { buttonClass, Input } from "./ui";

export function SearchBox({
  action,
  q,
  placeholder,
  showArchived,
  hidden = {},
}: {
  action: string;
  q: string;
  placeholder: string;
  showArchived?: boolean;
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} method="get" role="search" className="flex flex-wrap items-center gap-3">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="q" className="sr-only">
        Search
      </label>
      <Input id="q" name="q" type="search" defaultValue={q} placeholder={placeholder} className="max-w-md flex-1" autoComplete="off" />
      <button type="submit" className={buttonClass("secondary")}>
        Search
      </button>
      {showArchived !== undefined ? (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} className="size-4 rounded border-slate-300" />
          Include archived
        </label>
      ) : null}
    </form>
  );
}

export function Pagination({
  path,
  params,
  page,
  pageSize,
  total,
}: {
  path: string;
  params: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-slate-200 px-6 py-3 text-sm">
      <span className="text-slate-600">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={withParams(path, { ...params, page: page - 1 })} className={buttonClass("secondary", "py-1.5")}>
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={withParams(path, { ...params, page: page + 1 })} className={buttonClass("secondary", "py-1.5")}>
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

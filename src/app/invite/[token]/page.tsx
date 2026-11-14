import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Alert, buttonClass, Card } from "@/components/ui";
import { signOut } from "@/app/(auth)/actions";
import { getUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Join workshop" };

const STATUS_MESSAGES: Record<string, string> = {
  accepted: "This invitation has already been used.",
  revoked: "This invitation was cancelled by the workshop owner.",
  expired: "This invitation has expired. Ask the owner to send a new one.",
};

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data }, user] = await Promise.all([supabase.rpc("get_invitation", { p_token: token }), getUser()]);
  const invite = data?.[0];
  const path = `/invite/${token}`;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-lg text-slate-900">
        <Logo />
      </div>
      <Card className="w-full max-w-md p-6 sm:p-8">
        {!invite ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Invitation not found</h1>
            <p className="mt-2 text-sm text-slate-600">Check that you opened the full link, or ask the owner to send a new one.</p>
          </>
        ) : invite.status !== "pending" ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">{invite.workshop_name}</h1>
            <div className="mt-4">
              <Alert>{STATUS_MESSAGES[invite.status] ?? "This invitation is no longer valid."}</Alert>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">You&apos;ve been invited to join</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">{invite.workshop_name}</h1>
            <p className="mt-2 text-sm text-slate-600">
              as <span className="font-medium text-slate-900">{ROLE_LABELS[invite.role]}</span>. The invitation was sent to{" "}
              <span className="font-medium text-slate-900">{invite.email}</span>.
            </p>

            {!user ? (
              <div className="mt-6 grid gap-3">
                <Link
                  href={`/register?next=${encodeURIComponent(path)}&email=${encodeURIComponent(invite.email)}`}
                  className={buttonClass("primary")}
                >
                  Create an account
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(path)}&email=${encodeURIComponent(invite.email)}`}
                  className={buttonClass("secondary")}
                >
                  I already have an account
                </Link>
              </div>
            ) : user.email?.toLowerCase() === invite.email ? (
              <AcceptForm token={token} />
            ) : (
              <div className="mt-6 space-y-4">
                <Alert>
                  You&apos;re signed in as {user.email}. Log out, then sign in as {invite.email} to accept.
                </Alert>
                <form action={signOut}>
                  <button type="submit" className={buttonClass("secondary", "w-full")}>
                    Log out
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </Card>
    </main>
  );
}

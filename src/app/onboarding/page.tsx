import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui";
import { getMemberships, requireUser } from "@/lib/auth/session";
import { signOut } from "../(auth)/actions";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your workshop" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const memberships = await getMemberships();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="mb-8 text-lg text-slate-900">
        <Logo />
      </div>
      <Card className="w-full max-w-xl p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900">Set up your workshop</h1>
        <p className="mt-1 text-sm text-slate-600">
          You&apos;ll be the owner. You can invite your team and change any of this later in Settings.
        </p>
        <OnboardingForm />
      </Card>
      <div className="mt-6 flex items-center gap-4 text-sm text-slate-600">
        <span>Signed in as {user.email}</span>
        {memberships.length > 0 ? (
          <Link href="/dashboard" className="text-brand-700 hover:underline">
            Back to dashboard
          </Link>
        ) : null}
        <form action={signOut}>
          <button type="submit" className="text-brand-700 hover:underline">
            Log out
          </button>
        </form>
      </div>
      <p className="mt-3 max-w-xl text-center text-xs text-slate-500">
        Joining an existing workshop instead? Ask the owner to send you an invite link.
      </p>
    </main>
  );
}

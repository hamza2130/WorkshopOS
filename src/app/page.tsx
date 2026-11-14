import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { getUser } from "@/lib/auth/session";

export default async function Home() {
  if (await getUser()) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Logo className="text-slate-900" />
        <Link href="/login" className={buttonClass("ghost")}>
          Log in
        </Link>
      </header>
      <section className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Run your workshop from check-in to delivery
        </h1>
        <p className="mt-4 text-base text-slate-600">
          Job cards, estimates, customer approvals, mechanics, invoices and payments in one place — instead of paper
          job cards and scattered WhatsApp chats.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/register" className={buttonClass("primary", "px-5 py-2.5")}>
            Set up your workshop
          </Link>
          <Link href="/login" className={buttonClass("secondary", "px-5 py-2.5")}>
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
}

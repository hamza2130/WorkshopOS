import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const email = typeof params.email === "string" ? params.email : "";
  const linkError = params.error === "link";

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">Log in to your workshop</h1>
      <p className="mt-1 text-sm text-slate-600">Welcome back. Enter your email and password.</p>
      {linkError ? (
        <div className="mt-4">
          <Alert>That link has expired or was already used. Log in or request a new one.</Alert>
        </div>
      ) : null}
      <LoginForm next={next} defaultEmail={email} />
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">
          Forgot password?
        </Link>
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-brand-700 hover:underline">
          Create an account
        </Link>
      </div>
    </Card>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const email = typeof params.email === "string" ? params.email : "";

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">
        {next.startsWith("/invite/")
          ? "Create an account to join your workshop."
          : "Set up your login first, then your workshop."}
      </p>
      <RegisterForm next={next} defaultEmail={email} />
      <p className="mt-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}

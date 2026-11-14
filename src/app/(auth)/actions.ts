"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { invalid, passwordSchema, safeNext, type ActionState, formValues } from "@/lib/forms";
import { siteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const email = z.email("Enter a valid email address.").trim().toLowerCase();

const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your name.").max(120),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid phone number, e.g. 0300 1234567."),
    email,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

export async function signUp(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const next = safeNext(formData.get("next"), "/onboarding");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    const message =
      error.code === "weak_password"
        ? "That password is too weak. Use at least 8 characters with letters and numbers."
        : error.code === "over_email_send_rate_limit"
          ? "Too many attempts. Please wait a few minutes and try again."
          : "We couldn't create your account. Please try again.";
    return { error: message, values: formValues(formData) };
  }

  if (data.session) redirect(next);
  return {
    success: `We sent a confirmation link to ${parsed.data.email}. Open it on this device to continue.`,
  };
}

const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });

export async function signIn(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "Please confirm your email first. Check your inbox for the link."
        : "Incorrect email or password.";
    return { error: message, values: formValues(formData) };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the account exists, so emails can't be probed.
  return { success: "If an account exists for that email, a reset link is on its way." };
}

const resetSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

export async function updatePassword(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Choose a password you haven't used before."
          : "We couldn't update your password. Request a new reset link and try again.",
    };
  }
  redirect("/dashboard");
}

"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(_prev: { error?: string; success?: boolean } | null, formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  if (!email) return { error: "Email requis" };

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const redirectTo = `${proto}://${host}/reset-password`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) return { error: error.message };

  // Always return success (don't reveal if email exists)
  return { success: true };
}

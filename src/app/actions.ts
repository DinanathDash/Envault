// Copyright (c) 2026 Dinanath (dinanath.dev). All rights reserved.
// Licensed under the Functional Source License, Version 1.1-MIT. See LICENSE file in the project root for full license information.

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { authRateLimit } from "@/lib/infra/ratelimit";
import { sendSecurityAlertEmail } from "@/lib/infra/email";

function resolveAuthBaseUrl(headersList: Headers): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const origin = headersList.get("origin")?.trim();
  if (origin) return origin.replace(/\/+$/, "");

  const forwardedHost = headersList.get("x-forwarded-host")?.trim();
  if (forwardedHost) {
    const proto = headersList.get("x-forwarded-proto")?.trim() || "https";
    return `${proto}://${forwardedHost}`;
  }

  const host = headersList.get("host")?.trim();
  if (host) return `https://${host}`;

  // Final fallback to avoid malformed redirectTo like "null/auth/callback".
  return "https://envault.localhost:1355";
}

export async function signInWithGoogle(formData?: FormData) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = resolveAuthBaseUrl(headersList);
  const next = (formData?.get("next") as string) || "/dashboard";

  // Rate Limiting
  const ip = headersList.get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await authRateLimit.limit(ip);
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    console.error(error);
    redirect("/error");
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signInWithGithub(formData?: FormData) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = resolveAuthBaseUrl(headersList);
  const next = (formData?.get("next") as string) || "/dashboard";

  // Rate Limiting
  const ip = headersList.get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await authRateLimit.limit(ip);
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    console.error(error);
    redirect("/error");
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signInWithPassword(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const next = formData.get("next") as string;

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await authRateLimit.limit(ip);
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // If the account was previously scheduled for deletion, logging in within
  // the grace period should cancel that request.
  try {
    const { data: userResult } = await supabase.auth.getUser();
    const authedUser = userResult?.user;
    if (authedUser) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminSupabase = createAdminClient();

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString();

      await adminSupabase
        .from("profiles")
        .update({ deletion_scheduled_at: null })
        .eq("id", authedUser.id)
        .gte("deletion_scheduled_at", sevenDaysAgo);
    }
  } catch (e) {
    console.error("Failed to clear scheduled deletion on login:", e);
  }

  if (next && next.startsWith("/")) {
    redirect(next);
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();
  const headersList = await headers();
  const origin = resolveAuthBaseUrl(headersList);

  // Rate Limiting
  const ip = headersList.get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await authRateLimit.limit(ip);
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteAccountAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminSupabase = createAdminClient();

  const { data: profileData } = await adminSupabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const actorName =
    profileData?.username ||
    (typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : undefined) ||
    (typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : undefined) ||
    null;
  const actorEmail = user.email ?? null;
  const actorDisplayName =
    actorName || actorEmail?.split("@")[0] || `user-${user.id.slice(0, 8)}`;

  // Schedule soft deletion instead of immediately removing the account.
  const { error: scheduleError } = await adminSupabase
    .from("profiles")
    .update({ deletion_scheduled_at: new Date().toISOString() })
    .eq("id", user.id);

  if (scheduleError) {
    console.error("Error scheduling account deletion:", scheduleError);
    return {
      error:
        "Failed to schedule account deletion. Please try again or contact support.",
    };
  }

  // Fire-and-forget security email about the scheduled deletion.
  if (actorEmail) {
    void sendSecurityAlertEmail(
      actorEmail,
      "Account Scheduled for Deletion",
      "You requested to delete your Envault account. Your account is now scheduled for deletion in 7 days. If you sign back in before then, the deletion will be automatically cancelled.",
      user.id,
      "/settings",
    );
  }

  await supabase.auth.signOut();
  redirect("/?accountDeletionScheduled=true");
}

export async function forgotPassword(formData: FormData) {
  const email = formData.get("email") as string;
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await authRateLimit.limit(ip);
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const supabase = await createClient();

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await authRateLimit.limit(ip);
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function getPersonalAccessTokens() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("personal_access_tokens")
    .select("*")
    .eq("user_id", user.id)
    .not("name", "ilike", "CLI Access Token%")
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { tokens: data };
}

export async function revokePersonalAccessToken(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Also revoke the paired Access Token for this device
  const { data: revokedToken } = await supabase
    .from("personal_access_tokens")
    .select("name, metadata")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("personal_access_tokens")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // Ensure ownership

  if (error) {
    return { error: error.message };
  }

  // If this was a refresh token, also delete the paired access token for the same device
  if (revokedToken?.name?.startsWith("CLI Refresh Token on ")) {
    const deviceName = revokedToken.name.replace("CLI Refresh Token on ", "");
    await supabase
      .from("personal_access_tokens")
      .delete()
      .eq("user_id", user.id)
      .eq("name", `CLI Access Token on ${deviceName}`);
  }

  return { success: true };
}

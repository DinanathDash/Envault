// Copyright (c) 2026 Dinanath (dinanath.dev). All rights reserved.
// Use is governed by the LICENSE file in the project root.

"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { authRateLimit } from "@/lib/infra/ratelimit";
import crypto from "crypto";
import {
  createMcpTokenCreatedNotification,
  createMcpTokenExpiredNotification,
  createMcpTokenRegeneratedNotification,
  createMcpTokenRevokedNotification,
} from "@/lib/system/notifications";
import { sendSecurityAlertEmail } from "@/lib/infra/email";
import {
  buildMcpTokenMaskedValue,
  computeMcpTokenExpiryIso,
  isAllowedMcpTtlDays,
  MCP_WEB_TOKEN_NAME,
} from "@/lib/security/mcp-token";

function scheduleMcpTokenSecuritySignals(params: {
  userId: string;
  email?: string | null;
  type: "created" | "regenerated" | "revoked" | "expired";
  tokenName?: string | null;
  ttlDays?: number | null;
  expiresAt?: string | null;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  after(async () => {
    const tasks: Promise<unknown>[] = [];

    if (
      params.type === "created" &&
      params.tokenName &&
      params.ttlDays &&
      params.expiresAt
    ) {
      tasks.push(
        createMcpTokenCreatedNotification(
          params.userId,
          params.tokenName,
          params.ttlDays,
          params.expiresAt,
        ),
      );
    } else if (
      params.type === "regenerated" &&
      params.tokenName &&
      params.ttlDays &&
      params.expiresAt
    ) {
      tasks.push(
        createMcpTokenRegeneratedNotification(
          params.userId,
          params.tokenName,
          params.ttlDays,
          params.expiresAt,
        ),
      );
    } else if (params.type === "revoked") {
      tasks.push(
        createMcpTokenRevokedNotification(
          params.userId,
          params.tokenName ?? null,
          params.ttlDays ?? null,
        ),
      );
    } else if (params.type === "expired") {
      tasks.push(
        createMcpTokenExpiredNotification(
          params.userId,
          params.tokenName ?? null,
          params.ttlDays ?? null,
          params.expiresAt ?? null,
        ),
      );
    }

    if (params.email) {
      tasks.push(
        sendSecurityAlertEmail(
          params.email,
          params.title,
          params.message,
          params.userId,
          "/settings?tab=security",
        ),
      );
    }

    await Promise.allSettled(tasks);
  });
}

function resolveAuthBaseUrl(headersList: Headers): string {
  // In development, always derive from the actual request origin so that
  // confirmation emails link back to localhost instead of the production URL.
  if (process.env.NODE_ENV !== "production") {
    const origin = headersList.get("origin")?.trim();
    if (origin) return origin.replace(/\/+$/, "");

    const forwardedHost = headersList.get("x-forwarded-host")?.trim();
    if (forwardedHost) {
      const proto = headersList.get("x-forwarded-proto")?.trim() || "https";
      return `${proto}://${forwardedHost}`;
    }

    const host = headersList.get("host")?.trim();
    if (host) return `https://${host}`;

    return "https://envault.localhost:1355";
  }

  // Production: prefer the explicit env var, then fall back to headers.
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

  return "https://envault.localhost:1355";
}

function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
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
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}&authProvider=google`,
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
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}&authProvider=github`,
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
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error:
          "Please verify your email before signing in. Check your inbox for a confirmation link.",
      };
    }
    return { error: "Invalid email or password. If you haven't created an account yet, please sign up." };
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
      emailRedirectTo: `${origin}/auth/callback`,
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

export async function deleteAccountAction(userTimezone?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminSupabase = createAdminClient();
  const { data: scheduledAtData, error: schedulingError } =
    await adminSupabase.rpc("schedule_account_deletion", {
      p_user_id: user.id,
    });

  if (schedulingError) {
    console.error("Error scheduling account deletion:", schedulingError);
    return { error: "Failed to schedule account deletion. Please try again." };
  }

  const scheduledAtIso =
    typeof scheduledAtData === "string"
      ? scheduledAtData
      : new Date().toISOString();
  const deletionDeadlineIso = new Date(
    new Date(scheduledAtIso).getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const userEmail = user.email;
  const normalizedTimezone =
    typeof userTimezone === "string" && isValidIanaTimezone(userTimezone)
      ? userTimezone
      : null;

  if (userEmail) {
    after(async () => {
      try {
        const { sendAccountScheduledDeletionEmail } =
          await import("@/lib/infra/email");
        await sendAccountScheduledDeletionEmail(
          userEmail,
          scheduledAtIso,
          deletionDeadlineIso,
          normalizedTimezone,
        );
      } catch (error) {
        console.error("Failed to send scheduled deletion email:", error);
      }
    });
  }

  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?accountDeletionScheduled=true");
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

export async function getMcpWebTokenStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const admin = createAdminClient();

  const { data: tokenData, error: tokenError } = await admin
    .from("personal_access_tokens")
    .select("id, expires_at, last_used_at, metadata")
    .eq("user_id", user.id)
    .eq("name", MCP_WEB_TOKEN_NAME)
    .maybeSingle();

  if (tokenError) {
    return { error: tokenError.message };
  }

  if (!tokenData) {
    return { token: null };
  }

  const expiresAt = tokenData.expires_at
    ? new Date(tokenData.expires_at)
    : null;
  if (expiresAt && expiresAt < new Date()) {
    const meta = (tokenData.metadata || {}) as {
      token_name?: string;
      ttl_days?: number;
    };

    await admin
      .from("personal_access_tokens")
      .delete()
      .eq("user_id", user.id)
      .eq("name", MCP_WEB_TOKEN_NAME);

    await admin
      .from("profiles")
      .update({
        mcp_web_token_hash: null,
        mcp_web_token_ttl_days: null,
        mcp_web_token_expires_at: null,
      })
      .eq("id", user.id);

    scheduleMcpTokenSecuritySignals({
      userId: user.id,
      email: user.email,
      type: "expired",
      tokenName: meta.token_name ?? null,
      ttlDays: typeof meta.ttl_days === "number" ? meta.ttl_days : null,
      expiresAt: tokenData.expires_at,
      title: "MCP Token Expired and Removed",
      message: `Your MCP token${meta.token_name ? ` (${meta.token_name})` : ""} reached its validity window and was removed automatically.`,
      metadata: {
        source: "mcp_web",
        event: "token_expired_auto_deleted",
        ttl_days: meta.ttl_days ?? null,
      },
    });

    return { token: null };
  }

  const meta = (tokenData.metadata || {}) as {
    token_suffix?: string;
    token_masked?: string;
    token_name?: string;
    ttl_days?: number;
  };

  return {
    token: {
      id: tokenData.id,
      name:
        typeof meta.token_name === "string" && meta.token_name.trim().length > 0
          ? meta.token_name.trim()
          : "MCP Token",
      masked:
        typeof meta.token_masked === "string" &&
        meta.token_masked.trim().length > 0
          ? meta.token_masked.trim()
          : typeof meta.token_suffix === "string" &&
              meta.token_suffix.trim().length > 0
            ? `envault_at_...${meta.token_suffix.trim()}`
            : "envault_at_***",
      ttlDays: typeof meta.ttl_days === "number" ? meta.ttl_days : null,
      lastUsedAt: tokenData.last_used_at,
      expiresAt: tokenData.expires_at,
    },
  };
}

export async function generateMcpWebToken(input: {
  tokenName: string;
  ttlDays: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const tokenName = String(input.tokenName || "").trim();
  const ttlDays = Number(input.ttlDays);

  if (!tokenName) {
    return { error: "Token name is required" };
  }

  if (!isAllowedMcpTtlDays(ttlDays)) {
    return { error: "Invalid TTL. Allowed values are 7, 15, or 30 days." };
  }

  const rawToken = `envault_at_${crypto.randomUUID()}`;
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = computeMcpTokenExpiryIso(ttlDays);
  const masked = buildMcpTokenMaskedValue(rawToken);
  const suffix = rawToken.slice(-6);

  const admin = createAdminClient();

  const { data: existingToken } = await admin
    .from("personal_access_tokens")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", MCP_WEB_TOKEN_NAME)
    .maybeSingle();

  const isRegeneration = !!existingToken;

  const { error: upsertError } = await admin
    .from("personal_access_tokens")
    .upsert(
      {
        user_id: user.id,
        name: MCP_WEB_TOKEN_NAME,
        token_hash: tokenHash,
        last_used_at: new Date().toISOString(),
        expires_at: expiresAt,
        metadata: {
          source: "mcp_web",
          token_name: tokenName,
          ttl_days: ttlDays,
          token_suffix: suffix,
          token_masked: masked,
        },
      },
      { onConflict: "user_id,name" },
    );

  if (upsertError) {
    return { error: upsertError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      mcp_web_token_hash: tokenHash,
      mcp_web_token_ttl_days: ttlDays,
      mcp_web_token_expires_at: expiresAt,
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  scheduleMcpTokenSecuritySignals({
    userId: user.id,
    email: user.email,
    type: isRegeneration ? "regenerated" : "created",
    tokenName,
    ttlDays,
    expiresAt,
    title: isRegeneration ? "MCP Token Regenerated" : "MCP Token Created",
    message: isRegeneration
      ? `Your MCP token (${tokenName}) was regenerated from account security settings and is now valid for ${ttlDays} days.`
      : `A new MCP token (${tokenName}) was created from account security settings and is valid for ${ttlDays} days.`,
    metadata: {
      source: "mcp_web",
      event: isRegeneration ? "token_regenerated" : "token_created",
      ttl_days: ttlDays,
      expires_at: expiresAt,
    },
  });

  return {
    token: rawToken,
    masked,
    name: tokenName,
    ttlDays,
    expiresAt,
    message:
      "Token generated successfully. This is the only time the full token will be shown.",
  };
}

export async function revokeMcpWebToken() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const admin = createAdminClient();

  const { data: existingToken } = await admin
    .from("personal_access_tokens")
    .select("metadata")
    .eq("user_id", user.id)
    .eq("name", MCP_WEB_TOKEN_NAME)
    .maybeSingle();

  const { error: tokenDeleteError } = await admin
    .from("personal_access_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("name", MCP_WEB_TOKEN_NAME);

  if (tokenDeleteError) {
    return { error: tokenDeleteError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      mcp_web_token_hash: null,
      mcp_web_token_ttl_days: null,
      mcp_web_token_expires_at: null,
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  const meta = (existingToken?.metadata || {}) as {
    token_name?: string;
    ttl_days?: number;
  };

  scheduleMcpTokenSecuritySignals({
    userId: user.id,
    email: user.email,
    type: "revoked",
    tokenName: meta.token_name ?? null,
    ttlDays: typeof meta.ttl_days === "number" ? meta.ttl_days : null,
    title: "MCP Token Revoked",
    message: `Your MCP token${meta.token_name ? ` (${meta.token_name})` : ""} was deleted from account security settings.`,
    metadata: {
      source: "mcp_web",
      event: "token_revoked",
      ttl_days: meta.ttl_days ?? null,
    },
  });

  return { success: true };
}

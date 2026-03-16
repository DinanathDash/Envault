// Copyright (c) 2026 Dinanath (dinanath.dev). All rights reserved.
// Licensed under the Functional Source License, Version 1.1-MIT. See LICENSE file in the project root for full license information.

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { authRateLimit } from "@/lib/ratelimit";
import { logAuditEvent } from "@/lib/audit-logger";

export async function signInWithGoogle(formData?: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const next = (formData?.get("next") as string) || "/dashboard";

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
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
  const origin = (await headers()).get("origin");
  const next = (formData?.get("next") as string) || "/dashboard";

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
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

  if (next && next.startsWith("/")) {
    redirect(next);
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
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

  // 0. Reassign shared ownership references before deleting the auth user.
  const { error: preparationError } = await adminSupabase.rpc(
    "prepare_user_account_deletion",
    {
      p_user_id: user.id,
      p_actor_name: actorName,
      p_actor_email: actorEmail,
    },
  );

  if (preparationError) {
    console.error(
      "Error preparing account deletion (reassignment/audit snapshot):",
      preparationError,
    );
    return {
      error:
        "Failed to prepare account deletion safely. Please try again or contact support.",
    };
  }

  // 0.5. Emit membership removal audit events before membership rows are deleted
  // so project owners have a clear trail that this member account was deleted.
  const { data: memberships } = await adminSupabase
    .from("project_members")
    .select("project_id, projects!inner(name)")
    .eq("user_id", user.id);

  if (memberships && memberships.length > 0) {
    await Promise.allSettled(
      memberships.map((membership) => {
        const projectName =
          (membership.projects as unknown as { name?: string })?.name ||
          "Project";

        return logAuditEvent({
          projectId: membership.project_id,
          actorId: user.id,
          actorType: "user",
          action: "member.removed",
          targetResourceId: user.id,
          metadata: {
            actor_name: actorDisplayName,
            actor_email: actorEmail || "",
            member_user_id: user.id,
            beneficiary_user_id: user.id,
            beneficiary_name: actorDisplayName,
            beneficiary_email: actorEmail || "",
            project_name: projectName,
            reason: "account_deleted",
            initiated_by: "self",
          },
        });
      }),
    );
  }

  // 1. Clean up user memberships and shared access
  // We must clean these up explicitly because they might be on projects/secrets NOT owned by the user,
  // or the foreign keys might not be set to CASCADE for these specific relationships.

  // Access Requests (where user is requesting access)
  const { error: reqError } = await adminSupabase
    .from("access_requests")
    .delete()
    .eq("user_id", user.id);
  if (reqError) console.error("Error deleting access requests:", reqError);

  // Secret Shares (where user is a viewer)
  const { error: shareError } = await adminSupabase
    .from("secret_shares")
    .delete()
    .eq("user_id", user.id);
  if (shareError) console.error("Error deleting secret shares:", shareError);

  // Project Members (where user is a member)
  const { error: memberError } = await adminSupabase
    .from("project_members")
    .delete()
    .eq("user_id", user.id);
  if (memberError)
    console.error("Error deleting project memberships:", memberError);

  // Secrets (where user updated them but doesn't own them)
  // We must NULL out the reference, otherwise we can't delete the user.
  // We do NOT want to delete the secret itself as it belongs to someone else.
  const { error: updatedByError } = await adminSupabase
    .from("secrets")
    .update({ last_updated_by: null })
    .eq("last_updated_by", user.id);

  if (updatedByError)
    console.error("Error nullifying updated_by:", updatedByError);

  // 2. Delete user's projects
  const { error: projectsError } = await adminSupabase
    .from("projects")
    .delete()
    .eq("user_id", user.id);

  if (projectsError) {
    console.error("Error deleting user projects:", projectsError);
    return { error: "Failed to clean up user data (projects)" };
  }

  // 3. Delete the user account
  const { error } = await adminSupabase.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("Error deleting user:", error);
    return { error: error.message };
  }

  await supabase.auth.signOut();
  redirect("/?accountDeleted=true");
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

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateGitHubAppJWT } from "@/lib/auth/github";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://envault.localhost:1355";
}

/**
 * Fetches the installation account info (login + type) from the GitHub App API.
 * Uses the App JWT so no additional permissions are required.
 */
async function getInstallationAccount(
  installationId: string,
): Promise<{ account_login: string; account_type: string } | null> {
  try {
    const appJwt = generateGitHubAppJWT();
    const res = await fetch(
      `https://api.github.com/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: "application/vnd.github.v3+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      account?: { login?: string; type?: string };
    };
    return {
      account_login: data.account?.login ?? "",
      account_type: data.account?.type ?? "User",
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationId = searchParams.get("installation_id");
  const oauthCode = searchParams.get("code");
  const oauthState = searchParams.get("state");

  // OAuth account-picker flow: user came from /api/github/add-account, picked
  // an account in GitHub's native picker, and was redirected here with `code`
  // but no `installation_id`. We use this branch purely to bounce them to the
  // App installation page - NOW under the GitHub session they just chose.
  if (!installationId && oauthCode) {
    const cookieStore = await cookies();
    const projectFromCookie = cookieStore.get("github_oauth_project_id")?.value;
    const projectId = oauthState || projectFromCookie || "";

    const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "envault";
    const installUrl = new URL(
      `https://github.com/apps/${appName}/installations/new`,
    );

    // Pass the project id through a fresh cookie so the installation
    // callback (this same route, with installation_id) can look it up.
    const response = NextResponse.redirect(installUrl);
    if (projectId) {
      response.cookies.set("github_oauth_project_id", projectId, {
        maxAge: 300,
        path: "/",
        sameSite: "lax",
      });
    }
    return response;
  }

  if (!installationId) {
    return NextResponse.json(
      { error: "Missing installation_id" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const projectId = cookieStore.get("github_oauth_project_id")?.value;

  if (!projectId) {
    return NextResponse.redirect(
      new URL("/dashboard?error=missing_project_state", baseUrl()),
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(
        `/login?next=/api/github/callback?installation_id=${installationId}`,
        baseUrl(),
      ),
    );
  }

  // Verify permission: User must be Owner or Editor of the project
  const { data: projectMember } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  const { data: projectOwner } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  const isOwner = projectOwner && projectOwner.user_id === user.id;
  const isEditor =
    projectMember && ["owner", "editor"].includes(projectMember.role);

  if (!isOwner && !isEditor) {
    return NextResponse.json(
      {
        error: "Unauthorized: You do not have permission to edit this project.",
      },
      { status: 403 },
    );
  }

  const adminSupabase = createAdminClient();

  // Fetch account info from GitHub App API (login + type)
  const accountInfo = await getInstallationAccount(installationId);

  // Upsert into github_installations so this user can select this installation
  // from any project. On conflict (same user + installation), update account info.
  await adminSupabase.from("github_installations").upsert(
    {
      user_id: user.id,
      installation_id: parseInt(installationId),
      account_login: accountInfo?.account_login ?? null,
      account_type: accountInfo?.account_type ?? null,
    },
    { onConflict: "user_id,installation_id" },
  );

  // Audit: record that a GitHub account was connected for this project
  const { logAuditEvent } = await import("@/lib/system/audit-logger");
  logAuditEvent({
    projectId,
    actorId: user.id,
    actorType: "user",
    action: "github.account_connected",
    targetResourceId: installationId,
    metadata: {
      installation_id: parseInt(installationId),
      account_login: accountInfo?.account_login ?? null,
      account_type: accountInfo?.account_type ?? null,
    },
  }).catch((e) => console.error("[Audit] github.account_connected failed:", e));

  // Fetch the project slug so we can redirect back to the correct project URL
  const { data: projectData } = await adminSupabase
    .from("projects")
    .select("slug")
    .eq("id", projectId)
    .single();

  // Clear the linked repo so the UI prompts the user to pick one
  const { error } = await adminSupabase
    .from("projects")
    .update({
      github_repo_full_name: null,
    })
    .eq("id", projectId);

  if (error) {
    const fallbackSlug = projectData?.slug || projectId;
    return NextResponse.redirect(
      new URL(`/project/${fallbackSlug}?error=github_link_failed`, baseUrl()),
    );
  }

  const projectSlug = projectData?.slug || projectId;
  const redirectResponse = NextResponse.redirect(
    new URL(`/project/${projectSlug}?success=github_linked`, baseUrl()),
  );
  redirectResponse.cookies.set("github_oauth_project_id", "", {
    maxAge: 0,
    path: "/",
  });
  return redirectResponse;
}

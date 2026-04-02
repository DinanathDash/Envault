import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://envault.localhost:1355";
}

/**
 * Server-side route that initiates a GitHub OAuth authorization flow.
 * Because it goes through /login/oauth/authorize (not the App install URL),
 * GitHub shows its native account picker - "Continue as X / Use a different account".
 * After the user picks an account, GitHub redirects to /api/github/callback
 * with `code` + `state`. The callback detects the OAuth-only flow (no installation_id)
 * and sends the user to the GitHub App installation page for the now-active session.
 *
 * This route requires authentication so it can verify the project before
 * initiating the OAuth flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id") ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", baseUrl()));
  }

  if (!projectId) {
    return NextResponse.redirect(new URL("/dashboard", baseUrl()));
  }

  const clientId = process.env.ENVAULT_GITHUB_APP_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub App not configured" },
      { status: 500 },
    );
  }

  const oauthUrl = new URL("https://github.com/login/oauth/authorize");
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("redirect_uri", `${baseUrl()}/api/github/callback`);
  // state encodes projectId so the callback knows which project to update
  oauthUrl.searchParams.set("state", projectId);
  // No scopes needed - we only use this to trigger the account picker.
  // The actual installation gets its own permissions through the App install flow.
  oauthUrl.searchParams.set("scope", "");

  const response = NextResponse.redirect(oauthUrl);
  // Also persist the project id in a cookie as a fallback if state is lost
  response.cookies.set("github_oauth_project_id", projectId, {
    maxAge: 300,
    path: "/",
    sameSite: "lax",
    secure: !process.env.NODE_ENV || process.env.NODE_ENV === "production",
  });

  return response;
}

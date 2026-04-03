import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

// Use Service Role to securely query the token table, bypassing RLS
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const agentId = body?.agentId;
  const projectId = body?.projectId;

  if (!agentId || !projectId) {
    return NextResponse.json(
      { error: "agentId and projectId are required" },
      { status: 400 },
    );
  }

  // FIX: Removed NextResponse.next(). Route handlers should not mutate session cookies directly here.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() { /* Ignore cookie setting for this API route */ },
      },
    },
  );

  let resolvedUserId: string | null = null;

  // 1. Try standard Web Session (JWT) first
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    resolvedUserId = user.id;
  } 
  // 2. If no web session, check for CLI Bearer Token (PAT)
  else {
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (bearer) {
      const tokenHash = crypto.createHash("sha256").update(bearer).digest("hex");

      const { data: tokenData } = await supabaseService
        .from("personal_access_tokens")
        .select("user_id, expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      
      if (tokenData) {
        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
          return NextResponse.json(
            { error: "token_expired" },
            { status: 401 },
          );
        }

        resolvedUserId = tokenData.user_id;
      }
    }
  }

  if (!resolvedUserId) {
    return NextResponse.json({ error: "Unauthorized: Invalid session or CLI token" }, { status: 401 });
  }

  // 3. Verify Project Access (Owner or Member)
  const { data: project, error: projectError } = await supabaseService
    .from("projects")
    .select("user_id") 
    .eq("id", projectId)
    .single();

  let hasAccess = false;

  if (!projectError && project && project.user_id === resolvedUserId) {
    hasAccess = true;
  } else {
    // If not the direct owner, check if they are an invited member
    const { data: member } = await supabaseService
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", resolvedUserId)
      .single();

    if (member) {
      hasAccess = true;
    }
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden: You do not have access to this project" },
      { status: 403 },
    );
  }

  // 4. Mint the Agent JWT
  const secret = process.env.ENVAULT_AGENT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Agent token secret is not configured" },
      { status: 500 },
    );
  }

  const signed = jwt.sign(
    {
      sub: resolvedUserId,
      act: agentId,
      projects: [projectId],
    },
    secret,
    { expiresIn: "1h" },
  );

  return NextResponse.json({ token: `envault_agt_${signed}` });
}
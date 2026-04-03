import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { verifySdkAuth } from "@/lib/sdk/auth";

// Initialize Supabase Service Role client to bypass RLS for trusted backend operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const LOCAL_APP_URL = "https://envault.localhost:1355";
const PROD_APP_URL = "https://envault.tech";

function resolveSdkApprovalBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || PROD_APP_URL;

  try {
    const parsed = new URL(configured);

    if (parsed.origin === LOCAL_APP_URL) {
      return LOCAL_APP_URL;
    }

    if (parsed.origin === PROD_APP_URL || parsed.hostname === "envault.tech") {
      return parsed.origin.replace(/\/$/, "");
    }

    // We only allow two valid identities for approval links.
    return process.env.NODE_ENV === "production" ? PROD_APP_URL : LOCAL_APP_URL;
  } catch {
    return process.env.NODE_ENV === "production" ? PROD_APP_URL : LOCAL_APP_URL;
  }
}

export async function POST(req: NextRequest) {
  // 1. Auth and Idempotency Validation
  const idempotencyKey = req.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "Idempotency-Key header is required" },
      { status: 400 },
    );
  }

  const body = await req.json();
  const { projectId, payload } = body;

  if (!projectId || !payload) {
    return NextResponse.json(
      { error: "Missing projectId or payload" },
      { status: 400 },
    );
  }

  // 1.5 Real Auth Check (Redis/JWT middleware bypasses Next.js standard middleware)
  const authResult = await verifySdkAuth(req, projectId);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { agentId } = authResult;
  const baseUrl = resolveSdkApprovalBaseUrl();

  // 2. Hash the payload for cryptographic sign-off
  const payloadString = JSON.stringify(payload);
  const payloadHash = crypto
    .createHash("sha256")
    .update(payloadString)
    .digest("hex");

  // 3. Create Pending Approval (Idempotent)
  const { data: approval, error: approvalError } = await supabase
    .from("pending_approvals")
    .insert({
      project_id: projectId,
      agent_id: agentId,
      payload_hash: payloadHash,
      payload_data: payload,
      idempotency_key: idempotencyKey,
      status: "pending",
    })
    .select("id")
    .single();

  if (approvalError) {
    // Handle uniqueness violation for Idempotency-Key (Postgres code 23505)
    if (approvalError.code === "23505") {
      const { data: existing } = await supabase
        .from("pending_approvals")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .single();

      if (existing) {
        const existingApprovalUrl = `${baseUrl}/approve/${existing.id}`;
        return NextResponse.json(
          {
            message: `Action paused. Human approval required. View request at: ${existingApprovalUrl}`,
            approval_id: existing.id,
            approval_url: existingApprovalUrl,
            status: "pending",
          },
          { status: 202 },
        );
      }
    }

    console.error("[Agent SDK] Failed to create approval:", approvalError);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }

  // 4. Trigger Web UI Notification (Supabase WebSockets)
  await supabase.from("notifications").insert({
    project_id: projectId,
    type: "agent_approval",
    title: "Agent Action Requires Approval",
    message: `Agent ${agentId} is proposing a change.`,
    metadata: { approval_id: approval.id, payload_hash: payloadHash },
  });

  // 5. Return 202 Accepted to pause agent execution
  const approvalUrl = `${baseUrl}/approve/${approval.id}`;
  return NextResponse.json(
    {
      message: `Action paused. Human approval required. View request at: ${approvalUrl}`,
      approval_id: approval.id,
      approval_url: approvalUrl,
      status: "pending",
    },
    { status: 202 },
  );
}

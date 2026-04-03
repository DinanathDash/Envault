import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySdkAuth } from "@/lib/sdk/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: approvalId } = await params;

  if (!approvalId) {
    return NextResponse.json({ error: "Missing approval ID" }, { status: 400 });
  }

  // 1. Initial check to determine project context and ownership
  const { data: current } = await supabase
    .from("pending_approvals")
    .select("project_id, agent_id, status")
    .eq("id", approvalId)
    .single();

  if (!current) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  // 2. Perform full Redis/JWT strict auth check now that we have projectId
  const authResult = await verifySdkAuth(req, current.project_id);
  if (authResult instanceof NextResponse) {
    return authResult; // Contains 401/429/403 states from middleware
  }

  // Prevent polling endpoint data leaks (Flaw #5)
  if (authResult.agentId !== current.agent_id) {
    return NextResponse.json(
      { error: "Context Boundary Violation: Agent mismatch." },
      { status: 403 },
    );
  }

  // 3. State Evaluations
  if (current.status === "pending") {
    const { data: hashRow } = await supabase
      .from("pending_approvals")
      .select("payload_hash")
      .eq("id", approvalId)
      .single();

    return NextResponse.json(
      { status: "pending", payload_hash: hashRow?.payload_hash ?? null },
      { status: 202 },
    );
  }

  if (current.status === "rejected") {
    return NextResponse.json(
      { status: "rejected", error: "Human rejected the action" },
      { status: 403 },
    );
  }

  if (current.status === "expired") {
    // It was already burned or TTL expired. 410 Gone prevents replay extraction.
    return NextResponse.json(
      { error: "Resource Gone (Already Consumed or Expired)" },
      { status: 410 },
    );
  }

  // 4. One-Time Read Burn (Using a destructive UPDATE to read payload)
  // We only reach here if current.status was 'approved' during our lookup.
  const { data: burnedApproval, error } = await supabase
    .from("pending_approvals")
    .update({
      status: "expired", // Burn the status immediately
      updated_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .eq("status", "approved") // Concurrency safe
    .select("payload_data, status")
    .single();

  if (error || !burnedApproval) {
    // Concurrency race lost - someone else burned it
    return NextResponse.json(
      { error: "Resource Gone (Already Consumed)" },
      { status: 410 },
    );
  }

  // 5. Success (Burn Successful)
  return NextResponse.json({
    status: "approved",
    payload: burnedApproval.payload_data,
  });
}

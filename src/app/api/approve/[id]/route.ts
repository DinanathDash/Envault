import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { verifyHmacSignature } from "@/lib/utils/hmac";
import { validateCliToken } from "@/lib/auth/cli-auth";

// The service role is needed to update the `pending_approvals` status due to RLS locking down inserts/updates
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type PendingMutation = {
  key: string;
  value?: string;
  action: "upsert" | "delete";
};

type PendingPayload = {
  mutations: PendingMutation[];
};

type ProjectEnvironment = {
  id: string;
  slug: string;
  is_default: boolean | null;
};

type ActorSnapshot = {
  id: string;
  name: string;
  email: string;
};

type ApprovalActor = {
  id: string;
  email: string;
  username: string;
  channel: "web" | "cli";
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: approvalId } = await params;
  if (!approvalId) {
    return NextResponse.json({ error: "Missing approval ID" }, { status: 400 });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  const signature = req.headers.get("X-Signature");
  const timestamp = req.headers.get("X-Timestamp");

  const rawBody = await req.text();
  let action: unknown;
  try {
    action = JSON.parse(rawBody).action;
  } catch {
    return NextResponse.json(
      { error: "Invalid action payload" },
      { status: 400 },
    );
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Invalid action payload" },
      { status: 400 },
    );
  }

  const nextStatus = action === "approve" ? "approved" : "rejected";

  let actor: ApprovalActor;

  if (bearerToken) {
    if (!bearerToken.startsWith("envault_at_")) {
      return NextResponse.json(
        { error: "Invalid CLI access token format" },
        { status: 401 },
      );
    }

    const cliAuth = await validateCliToken(req);
    if (cliAuth instanceof NextResponse) {
      return cliAuth;
    }

    if (cliAuth.type !== "user") {
      return NextResponse.json(
        { error: "Only user-bound CLI access tokens can approve requests" },
        { status: 403 },
      );
    }

    const { data: actorUserData } = await supabaseService.auth.admin.getUserById(
      cliAuth.userId,
    );

    actor = {
      id: cliAuth.userId,
      email: actorUserData?.user?.email || "",
      username:
        (typeof actorUserData?.user?.user_metadata?.username === "string"
          ? actorUserData.user.user_metadata.username
          : "") || "Unknown User",
      channel: "cli",
    };
  } else {
    // Browser/web flow: authenticate via SSR cookies.
    let supabaseResponse = NextResponse.next({ request: req });
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              req.cookies.set(name, value),
            );
            supabaseResponse = NextResponse.next({
              request: req,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseSession.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized user" }, { status: 401 });
    }

    actor = {
      id: user.id,
      email: user.email || "",
      username:
        (typeof user.user_metadata?.username === "string"
          ? user.user_metadata.username
          : "") || "Unknown User",
      channel: "web",
    };
  }

  // 2. Fetch the pending request and hash
  // Fetch with Service Role, but we MUST STILL verify the project ID and user's role against it or trust the UI signature
  const { data: pendingApproval, error: pendingError } = await supabaseService
    .from("pending_approvals")
    .select("payload_hash, payload_data, status, project_id, agent_id")
    .eq("id", approvalId)
    .single();

  if (pendingError || !pendingApproval) {
    return NextResponse.json(
      { error: "Pending approval not found" },
      { status: 404 },
    );
  }

  if (pendingApproval.status !== "pending") {
    return NextResponse.json(
      { error: `Approval already ${pendingApproval.status}` },
      { status: 400 },
    );
  }

  // 3. Authorization: owner or owner/editor member can approve agent actions.
  const { data: project } = await supabaseService
    .from("projects")
    .select("user_id, default_environment_slug")
    .eq("id", pendingApproval.project_id)
    .single();

  const isProjectOwner = project?.user_id === actor.id;

  const { data: member } = await supabaseService
    .from("project_members") // Assuming project_members table from schema
    .select("role")
    .eq("project_id", pendingApproval.project_id)
    .eq("user_id", actor.id)
    .in("role", ["owner", "editor"])
    .single();

  if (!isProjectOwner && !member) {
    return NextResponse.json(
      { error: "Forbidden: Missing project access rights" },
      { status: 403 },
    );
  }

  // 4. Signature validation remains required for browser calls.
  if (actor.channel === "web") {
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature header" },
        { status: 400 },
      );
    }

    try {
      const backendKey = Buffer.from(
        process.env.ENVAULT_SESSION_KEY_SECRET || "temp-secret-key-123",
        "utf8",
      );
      const cryptoNode = await import("crypto");
      const expectedLegacySignature = cryptoNode
        .createHmac("sha256", backendKey)
        .update(pendingApproval.payload_hash)
        .digest("hex");

      let isValid = signature === expectedLegacySignature;

      if (!isValid && timestamp) {
        const apiSalt =
          process.env.NEXT_PUBLIC_API_SIGNATURE_SALT ||
          "default_dev_secret_so_it_works";
        isValid = await verifyHmacSignature(rawBody, timestamp, signature, apiSalt);
      }

      if (!isValid) {
        console.warn(
          `[Audit] Invalid UI Signature for approval: ${approvalId} by User: ${actor.id}`,
        );
        throw new Error("Mismatch");
      }
    } catch {
      return NextResponse.json(
        { error: "Verification of cryptographic signature failed" },
        { status: 403 },
      );
    }
  }

  const payloadAnyForAudit = pendingApproval.payload_data as
    | Record<string, unknown>
    | undefined;
  const auditMutationEntries = Array.isArray(
    (payloadAnyForAudit as { mutations?: unknown[] } | undefined)?.mutations,
  )
    ? ((payloadAnyForAudit as { mutations: Array<{ key?: string }> }).mutations || [])
    : [];
  const auditMutationKeys = auditMutationEntries
    .map((m) => (typeof m.key === "string" ? m.key : ""))
    .filter((k) => k.length > 0);
  const auditEnvironment =
    typeof payloadAnyForAudit?.environment === "string"
      ? payloadAnyForAudit.environment
      : typeof payloadAnyForAudit?.environmentSlug === "string"
        ? payloadAnyForAudit.environmentSlug
        : null;

  // 6. Execute vault mutations (when approved), then mark approval status.
  // NOTE: This is best-effort with compensating rollback, but not fully crash-atomic.
  // Future hardening: move this step into a single Postgres RPC transaction.
  if (action === "approve") {
    const payload = pendingApproval.payload_data as PendingPayload;
    const mutations = Array.isArray(payload?.mutations)
      ? payload.mutations
      : [];

    if (mutations.length === 0) {
      return NextResponse.json(
        { error: "Invalid pending payload: missing mutations" },
        { status: 400 },
      );
    }

    const payloadAny = pendingApproval.payload_data as Record<string, unknown>;
    const requestedEnvironmentSlug =
      typeof payloadAny.environment === "string"
        ? payloadAny.environment
        : typeof payloadAny.environmentSlug === "string"
          ? payloadAny.environmentSlug
          : typeof project?.default_environment_slug === "string"
            ? project.default_environment_slug
            : null;

    const { data: projectEnvironments, error: envError } = await supabaseService
      .from("project_environments")
      .select("id, slug, is_default")
      .eq("project_id", pendingApproval.project_id)
      .order("is_default", { ascending: false })
      .order("slug", { ascending: true });

    if (envError || !projectEnvironments || projectEnvironments.length === 0) {
      return NextResponse.json(
        { error: "Failed to resolve target environment for approved mutation" },
        { status: 500 },
      );
    }

    const environments = projectEnvironments as ProjectEnvironment[];
    const hasRequestedEnvironment =
      typeof requestedEnvironmentSlug === "string" &&
      requestedEnvironmentSlug.length > 0;

    if (
      hasRequestedEnvironment &&
      !environments.some((env) => env.slug === requestedEnvironmentSlug)
    ) {
      return NextResponse.json(
        {
          error: `Requested environment '${requestedEnvironmentSlug}' was not found in this project`,
        },
        { status: 400 },
      );
    }

    const targetEnvironment =
      environments.find((env) => env.slug === requestedEnvironmentSlug) ||
      environments.find((env) => env.slug === project?.default_environment_slug) ||
      environments.find((env) => env.is_default) ||
      environments[0];

    if (!targetEnvironment) {
      return NextResponse.json(
        { error: "No project environment available for approved mutation" },
        { status: 500 },
      );
    }


    const { data: actorProfile } = await supabaseService
      .from("profiles")
      .select("username")
      .eq("id", actor.id)
      .maybeSingle();

    const actorSnapshot: ActorSnapshot = {
      id: actor.id,
      name:
        actorProfile?.username ||
        actor.username ||
        "Unknown User",
      email: actor.email,
    };

    const agentAttributionName = `Envault Agent via ${actorSnapshot.name}`;

    const keys = mutations.map((m) => m.key);
    const { data: existingSecrets, error: existingError } =
      await supabaseService
        .from("secrets")
        .select("id, key, value, user_id, project_id, environment_id")
        .eq("project_id", pendingApproval.project_id)
        .in("key", keys);

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to load current secrets for rollback planning" },
        { status: 500 },
      );
    }

    const beforeMap = new Map<
      string,
      {
        id: string;
        key: string;
        value: string;
        user_id: string | null;
        project_id: string;
        environment_id: string | null;
      }
    >();
    for (const secret of existingSecrets || []) {
      if (secret.environment_id === targetEnvironment.id) {
        beforeMap.set(secret.key, secret);
        continue;
      }

      // Legacy rows may still carry a null environment_id. Reuse them to avoid duplicate inserts.
      if (!beforeMap.has(secret.key) && secret.environment_id === null) {
        beforeMap.set(secret.key, secret);
      }
    }
    const createdKeys = new Set<string>();
    const touchedKeys = new Set<string>();

    for (const mutation of mutations) {
      touchedKeys.add(mutation.key);
      if (!beforeMap.has(mutation.key) && mutation.action === "upsert") {
        createdKeys.add(mutation.key);
      }

      if (mutation.action === "upsert") {
        if (typeof mutation.value !== "string") {
          await rollbackMutations(
            pendingApproval.project_id,
            targetEnvironment.id,
            actor.id,
            beforeMap,
            createdKeys,
            touchedKeys,
          );
          return NextResponse.json(
            { error: `Invalid upsert mutation for key ${mutation.key}` },
            { status: 400 },
          );
        }

        const existingSecret = beforeMap.get(mutation.key);

        if (existingSecret) {
          const isSameEnvironment =
            existingSecret.environment_id === targetEnvironment.id;
          const isSameValue = existingSecret.value === mutation.value;

          // No-op update: same key/value already present in the target environment.
          // Keep the operation idempotent and avoid rewriting attribution/timestamps.
          if (isSameEnvironment && isSameValue) {
            continue;
          }

          const { error: updateSecretError } = await supabaseService
            .from("secrets")
            .update({
              environment_id: targetEnvironment.id,
              value: mutation.value,
              key_id: (mutation.value as string).split(":")[1] || null,
              last_updated_by: actor.id,
              last_updated_by_user_id_snapshot: actorSnapshot.id,
              last_updated_by_name: agentAttributionName,
              last_updated_by_email: actorSnapshot.email,
              last_updated_at: new Date().toISOString(),
            })
            .eq("id", existingSecret.id)
            .eq("project_id", pendingApproval.project_id);

          if (updateSecretError) {
            await rollbackMutations(
              pendingApproval.project_id,
              targetEnvironment.id,
              actor.id,
              beforeMap,
              createdKeys,
              touchedKeys,
            );
            return NextResponse.json(
              { error: "Failed to execute approved secret mutation" },
              { status: 500 },
            );
          }
          continue;
        }

        const { error: insertSecretError } = await supabaseService
          .from("secrets")
          .insert({
            project_id: pendingApproval.project_id,
            environment_id: targetEnvironment.id,
            user_id: actor.id,
            key: mutation.key,
            value: mutation.value,
            key_id: (mutation.value as string).split(":")[1] || null,
            created_by_user_id_snapshot: actorSnapshot.id,
            created_by_name: agentAttributionName,
            created_by_email: actorSnapshot.email,
            last_updated_by: actor.id,
            last_updated_by_user_id_snapshot: actorSnapshot.id,
            last_updated_by_name: agentAttributionName,
            last_updated_by_email: actorSnapshot.email,
            last_updated_at: new Date().toISOString(),
          });

        if (insertSecretError) {
          await rollbackMutations(
            pendingApproval.project_id,
            targetEnvironment.id,
            actor.id,
            beforeMap,
            createdKeys,
            touchedKeys,
          );
          return NextResponse.json(
            { error: "Failed to execute approved secret mutation" },
            { status: 500 },
          );
        }
      }

      if (mutation.action === "delete") {
        const { error: deleteError } = await supabaseService
          .from("secrets")
          .delete()
          .eq("project_id", pendingApproval.project_id)
          .eq("environment_id", targetEnvironment.id)
          .eq("key", mutation.key);

        if (deleteError) {
          await rollbackMutations(
            pendingApproval.project_id,
            targetEnvironment.id,
            actor.id,
            beforeMap,
            createdKeys,
            touchedKeys,
          );
          return NextResponse.json(
            { error: "Failed to execute approved secret mutation" },
            { status: 500 },
          );
        }
      }
    }
  }

  // 5. Audit Log Injection
  // We insert into audit_logs showing a human issued an agent action.
  const auditAction =
    action === "approve" ? "AGENT_APPROVED_CHANGE" : "AGENT_REJECTED_CHANGE";

  const { error: auditError } = await supabaseService.from("audit_logs").insert({
    project_id: pendingApproval.project_id,
    actor_id: actor.id,
    actor_type: "user",
    agent_id: pendingApproval.agent_id,
    delegator_user_id: actor.id,
    action: auditAction,
    metadata: {
      source: "agent_hitl",
      approval_id: approvalId,
      result: nextStatus,
      environment: auditEnvironment,
      mutation_count: auditMutationKeys.length,
      keys: auditMutationKeys,
      agent_id: pendingApproval.agent_id,
      agent_label: "Envault Agent",
    },
  });

  if (auditError) {
    console.error("[Agent Approval] Failed to write audit log:", auditError);
  }

  const { error: updateError } = await supabaseService
    .from("pending_approvals")
    .update({ status: nextStatus })
    .eq("id", approvalId)
    .eq("status", "pending");

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update approval status" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: `Request has been ${nextStatus}`,
  });
}

async function rollbackMutations(
  projectId: string,
  environmentId: string,
  actingUserId: string,
  beforeMap: Map<
    string,
    {
      id: string;
      key: string;
      value: string;
      user_id: string | null;
      project_id: string;
      environment_id: string | null;
    }
  >,
  createdKeys: Set<string>,
  touchedKeys: Set<string>,
) {
  // Remove rows created during this attempt.
  if (createdKeys.size > 0) {
    await supabaseService
      .from("secrets")
      .delete()
      .eq("project_id", projectId)
      .eq("environment_id", environmentId)
      .in("key", Array.from(createdKeys));
  }

  // Restore previous values for rows that existed before.
  const restoreRows = Array.from(touchedKeys)
    .map((key) => beforeMap.get(key))
    .filter(
      (
        row,
      ): row is {
        id: string;
        key: string;
        value: string;
        user_id: string | null;
        project_id: string;
        environment_id: string | null;
      } => Boolean(row),
    )
    .map((row) => ({
      id: row.id,
      key: row.key,
      value: row.value,
      project_id: row.project_id,
      environment_id: row.environment_id || environmentId,
      user_id: row.user_id || actingUserId,
    }));

  if (restoreRows.length > 0) {
    await supabaseService.from("secrets").upsert(restoreRows, {
      onConflict: "id",
    });
  }
}

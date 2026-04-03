import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditReadRateLimit } from "@/lib/infra/ratelimit";
import { getProjectRole } from "@/lib/auth/permissions";

const ALLOWED_AUDIT_ACTIONS = new Set([
  "secret.created",
  "secret.updated",
  "secret.deleted",
  "secret.read_batch",
  "member.invited",
  "member.role_updated",
  "member.removed",
  "transfer.requested",
  "transfer.accepted",
  "transfer.rejected",
  "environment.access_updated",
  "environment.access_granted",
  "environment.access_revoked",
  "github.account_connected",
  "github.account_disconnected",
  "github.repo_linked",
  "github.repo_unlinked",
  "AGENT_APPROVED_CHANGE",
  "AGENT_REJECTED_CHANGE",
]);

type EnvAccessState = "none" | "some" | "all" | "unknown";

function parseMaybeUuid(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
}

function normalizeEnvValue(value: unknown): string[] | "all" | null {
  if (value === "all") return "all";
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return null;
}

function getEnvAccessState(value: unknown): {
  state: EnvAccessState;
  key: string;
} {
  const normalized = normalizeEnvValue(value);
  if (normalized === "all") {
    return { state: "all", key: "all" };
  }
  if (Array.isArray(normalized)) {
    if (normalized.length === 0) {
      return { state: "none", key: "none" };
    }
    const key = [...normalized].sort().join("|");
    return { state: "some", key };
  }
  return { state: "unknown", key: "unknown" };
}

function deriveEnvironmentAccessAction(
  action: string,
  metadata: Record<string, unknown>,
): string {
  if (
    action !== "environment.access_granted" &&
    action !== "environment.access_revoked"
  ) {
    return action;
  }

  const changes =
    metadata.changes && typeof metadata.changes === "object"
      ? (metadata.changes as Record<string, unknown>)
      : null;
  const allowedChange =
    changes?.allowed_environments &&
    typeof changes.allowed_environments === "object"
      ? (changes.allowed_environments as Record<string, unknown>)
      : null;

  if (!allowedChange) return action;

  const oldState = getEnvAccessState(allowedChange.old);
  const newState = getEnvAccessState(allowedChange.new);

  if (oldState.state === "none" && newState.state !== "none") {
    return "environment.access_granted";
  }

  if (oldState.state !== "none" && newState.state === "none") {
    return "environment.access_revoked";
  }

  if (
    oldState.state !== "unknown" &&
    newState.state !== "unknown" &&
    oldState.key !== newState.key
  ) {
    return "environment.access_updated";
  }

  return action;
}

export async function GET(
  req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  try {
    const params = await props.params;
    const { projectId } = params;

    // Apply Rate Limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const { success } = await auditReadRateLimit.limit(`audit_read_${ip}`);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const url = new URL(req.url);
    const actorId =
      url.searchParams.get("actor_id") || url.searchParams.get("user_id");
    const action = url.searchParams.get("action");
    const isEnvAccessFilter =
      action === "environment.access_granted" ||
      action === "environment.access_revoked" ||
      action === "environment.access_updated";

    if (action && !ALLOWED_AUDIT_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "Invalid action filter" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure the requester is a project member/owner
    const role = await getProjectRole(supabase, projectId, user.id);
    if (!role) {
      return NextResponse.json(
        {
          error:
            "Forbidden: You do not have access to this project's audit logs",
        },
        { status: 403 },
      );
    }

    let query = supabase
      .from("audit_logs")
      .select(
        "id, created_at, project_id, actor_id, actor_type, action, target_resource_id, user_agent, metadata",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (actorId) {
      query = query.eq("actor_id", actorId);
    }

    if (isEnvAccessFilter) {
      query = query.in("action", [
        "environment.access_granted",
        "environment.access_revoked",
      ]);
    } else if (action) {
      query = query.eq("action", action);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error("[Audit API] Error fetching logs:", error);
      return NextResponse.json(
        { error: "Failed to fetch audit logs" },
        { status: 500 },
      );
    }

    const userActorIds = Array.from(
      new Set(
        (logs || [])
          .filter((log) => log.actor_type === "user")
          .map((log) => log.actor_id),
      ),
    );

    const beneficiaryUserIds = Array.from(
      new Set(
        (logs || [])
          .flatMap((log) => {
            const metadata =
              log.metadata && typeof log.metadata === "object"
                ? (log.metadata as Record<string, unknown>)
                : {};

            const ids = [
              parseMaybeUuid(metadata.member_user_id),
              parseMaybeUuid(metadata.beneficiary_user_id),
              parseMaybeUuid(metadata.previous_owner_id),
              parseMaybeUuid(metadata.new_owner_id),
              parseMaybeUuid(metadata.target_user_id),
              parseMaybeUuid(metadata.rejected_by_user_id),
              parseMaybeUuid(log.target_resource_id),
            ];

            return ids.filter((value): value is string => Boolean(value));
          })
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const machineActorIds = Array.from(
      new Set(
        (logs || [])
          .filter((log) => log.actor_type === "machine")
          .map((log) => log.actor_id),
      ),
    );

    const userNameById = new Map<string, string>();
    const userEmailById = new Map<string, string>();
    const userAvatarById = new Map<string, string>();
    const machineNameById = new Map<string, string>();

    const allUserIds = Array.from(
      new Set([...userActorIds, ...beneficiaryUserIds]),
    );

    if (allUserIds.length > 0) {
      const [{ data: profiles }, authUsers] = await Promise.all([
        supabase.from("profiles").select("id, username").in("id", allUserIds),
        Promise.all(
          allUserIds.map((id) => adminSupabase.auth.admin.getUserById(id)),
        ),
      ]);

      for (const profile of profiles || []) {
        if (profile.username) {
          userNameById.set(profile.id, profile.username);
        }
      }

      for (const result of authUsers) {
        const authUser = result.data?.user;
        if (!authUser) continue;
        const fallbackName =
          (authUser.user_metadata?.username as string | undefined) ||
          (authUser.user_metadata?.name as string | undefined) ||
          authUser.email?.split("@")[0] ||
          "Former Member";

        if (!userNameById.has(authUser.id)) {
          userNameById.set(authUser.id, fallbackName);
        }

        if (authUser.email) {
          userEmailById.set(authUser.id, authUser.email);
        }

        const avatarUrl =
          (authUser.user_metadata?.avatar_url as string | undefined) ||
          (authUser.user_metadata?.picture as string | undefined);
        if (avatarUrl) {
          userAvatarById.set(authUser.id, avatarUrl);
        }
      }
    }

    if (machineActorIds.length > 0) {
      const { data: tokens } = await supabase
        .from("service_tokens")
        .select("id, name")
        .in("id", machineActorIds);

      for (const token of tokens || []) {
        machineNameById.set(token.id, token.name || "Service Token");
      }
    }

    const enrichedLogs = (logs || []).map((log) => {
      const rawMetadata =
        log.metadata && typeof log.metadata === "object"
          ? (log.metadata as Record<string, unknown>)
          : {};
      const metadataActorName =
        typeof rawMetadata.actor_name === "string"
          ? rawMetadata.actor_name
          : "";
      const metadataActorEmail =
        typeof rawMetadata.actor_email === "string"
          ? rawMetadata.actor_email
          : "";

      const actorName =
        log.actor_type === "machine"
          ? machineNameById.get(log.actor_id) || "Service Token"
          : userNameById.get(log.actor_id) ||
            metadataActorName ||
            metadataActorEmail ||
            "Former Member";

      const metadata =
        log.metadata && typeof log.metadata === "object"
          ? ({ ...(log.metadata as Record<string, unknown>) } as Record<
              string,
              unknown
            >)
          : {};
      const beneficiaryUserId =
        parseMaybeUuid(metadata.member_user_id) ||
        parseMaybeUuid(metadata.beneficiary_user_id);

      if (beneficiaryUserId) {
        const existingBeneficiaryName =
          typeof metadata.beneficiary_name === "string"
            ? metadata.beneficiary_name
            : "";
        const existingBeneficiaryEmail =
          typeof metadata.beneficiary_email === "string"
            ? metadata.beneficiary_email
            : "";

        metadata.beneficiary_user_id = beneficiaryUserId;
        metadata.beneficiary_name =
          userNameById.get(beneficiaryUserId) ||
          existingBeneficiaryName ||
          existingBeneficiaryEmail ||
          "Former Member";
        metadata.beneficiary_email =
          userEmailById.get(beneficiaryUserId) ||
          existingBeneficiaryEmail ||
          "";
      }

      const transferUserMappings: Array<{
        idKey:
          | "previous_owner_id"
          | "new_owner_id"
          | "target_user_id"
          | "rejected_by_user_id";
        nameKey:
          | "previous_owner_name"
          | "new_owner_name"
          | "target_name"
          | "rejected_by_name";
        emailKey:
          | "previous_owner_email"
          | "new_owner_email"
          | "target_email"
          | "rejected_by_email";
      }> = [
        {
          idKey: "previous_owner_id",
          nameKey: "previous_owner_name",
          emailKey: "previous_owner_email",
        },
        {
          idKey: "new_owner_id",
          nameKey: "new_owner_name",
          emailKey: "new_owner_email",
        },
        {
          idKey: "target_user_id",
          nameKey: "target_name",
          emailKey: "target_email",
        },
        {
          idKey: "rejected_by_user_id",
          nameKey: "rejected_by_name",
          emailKey: "rejected_by_email",
        },
      ];

      for (const mapping of transferUserMappings) {
        const mappedId = parseMaybeUuid(metadata[mapping.idKey]);
        if (!mappedId) continue;

        const existingName =
          typeof metadata[mapping.nameKey] === "string"
            ? (metadata[mapping.nameKey] as string)
            : "";
        const existingEmail =
          typeof metadata[mapping.emailKey] === "string"
            ? (metadata[mapping.emailKey] as string)
            : "";

        metadata[mapping.nameKey] =
          userNameById.get(mappedId) ||
          existingName ||
          existingEmail ||
          "Former Member";
        metadata[mapping.emailKey] =
          userEmailById.get(mappedId) || existingEmail || "";
      }

      return {
        ...log,
        actor_name: actorName,
        actor_email:
          userEmailById.get(log.actor_id) || metadataActorEmail || "",
        actor_avatar: userAvatarById.get(log.actor_id) || "",
        metadata,
      };
    });

    const filteredLogs =
      isEnvAccessFilter && action
        ? enrichedLogs.filter((log) => {
            const metadata =
              log.metadata && typeof log.metadata === "object"
                ? (log.metadata as Record<string, unknown>)
                : {};
            return (
              deriveEnvironmentAccessAction(log.action, metadata) === action
            );
          })
        : enrichedLogs;

    return NextResponse.json({ logs: filteredLogs });
  } catch (error) {
    console.error("[Audit API] Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

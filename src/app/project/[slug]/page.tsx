import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import ProjectDetailView from "@/components/editor/project-detail-view";
import { getProjectEnvironments } from "@/lib/utils/cli-environments";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ env?: string }>;
}

function normalizeActorName(name?: string): string | undefined {
  if (!name) return undefined;
  const viaMatch = name.match(/\s+via\s+(.+)$/i);
  if (/^agent:/i.test(name) || /headless|e2e|test/i.test(name)) {
    if (viaMatch?.[1]) {
      return `Envault Agent via ${viaMatch[1].trim()}`;
    }
    return "Envault Agent";
  }
  return name;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  let title = slug;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("projects")
        .select("name")
        .eq("slug", slug)
        .eq("user_id", user.id)
        .single();

      if (data?.name) {
        title = data.name;
      }
    }
  } catch {
    // Fallback to slug
  }

  return {
    title,
    description: `Manage secrets and environment variables for ${title}`,
    openGraph: {
      siteName: "Envault",
      images: [
        `/api/og?title=${encodeURIComponent(title)}&section=Project&description=${encodeURIComponent("Encypted environment variables")}`,
      ],
    },
  };
}

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const requestedEnvSlug = query?.env;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the project by slug and user_id
  const { data: project, error: _projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .eq("user_id", user.id)
    .single();

  const id = project?.id;

  if (_projectError || !project) {
    notFound();
  }

  // Verify user has access to this project
  const { getProjectRole } = await import("@/lib/auth/permissions");
  const role = await getProjectRole(supabase, id, user.id);

  if (!role) {
    // User has no access to this project
    notFound();
  }

  const envList = await getProjectEnvironments(adminSupabase, id);
  const defaultEnvironmentSlug =
    project.default_environment_slug || "development";
  const targetSlug =
    project.ui_mode === "advanced" && requestedEnvSlug
      ? requestedEnvSlug
      : defaultEnvironmentSlug;
  const preferredEnvironment =
    envList.find((env) => env.slug === targetSlug) ||
    envList.find((env) => env.slug === defaultEnvironmentSlug) ||
    envList.find((env) => env.is_default) ||
    envList[0];

  let activeEnvironment = preferredEnvironment;
  if (!activeEnvironment) {
    notFound();
  }

  let allowedEnvironments: string[] | null = null;
  if (role !== "owner") {
    const { data: member } = await supabase
      .from("project_members")
      .select("allowed_environments")
      .eq("project_id", id)
      .eq("user_id", user.id)
      .single();

    if (member && Array.isArray(member.allowed_environments)) {
      allowedEnvironments = member.allowed_environments as string[];
    } else if (!member) {
      // Shared-secret-only users are not members; scope their env access to shared secrets.
      const { data: sharedEnvSecrets } = await supabase
        .from("secret_shares")
        .select("secrets!inner(environment_id, project_id)")
        .eq("user_id", user.id)
        .eq("secrets.project_id", id);

      const allowedEnvironmentIds = new Set(
        (sharedEnvSecrets || []).map((share) => {
          const secret = Array.isArray(share.secrets)
            ? share.secrets[0]
            : share.secrets;
          return secret.environment_id as string;
        }),
      );

      allowedEnvironments = envList
        .filter((env) => allowedEnvironmentIds.has(env.id))
        .map((env) => env.slug);
    }
  }

  if (
    allowedEnvironments &&
    !allowedEnvironments.includes(activeEnvironment.slug) &&
    !requestedEnvSlug
  ) {
    const firstAllowed = envList.find((env) =>
      allowedEnvironments!.includes(env.slug),
    );
    if (firstAllowed) {
      activeEnvironment = firstAllowed;
    }
  }

  const hasActiveEnvironmentAccess =
    !allowedEnvironments ||
    allowedEnvironments.includes(activeEnvironment.slug);

  let secrets: Array<{
    id: string;
    key: string;
    value: string;
    user_id: string | null;
    last_updated_by: string | null;
    last_updated_at: string | null;
    [key: string]: unknown;
  }> = [];
  let secretsError: { message: string } | null = null;
  if (hasActiveEnvironmentAccess) {
    const { data, error } = await supabase
      .from("secrets")
      .select("*")
      .eq("project_id", id)
      .eq("environment_id", activeEnvironment.id)
      .order("created_at", { ascending: true });
    secrets = data || [];
    secretsError = error;
  }

  if (secretsError) {
    console.error(`[ProjectPage] Error fetching secrets:`, secretsError);
  }

  // Fetch shared secrets for this user
  const { data: sharedSecrets, error: sharedSecretsError } = await supabase
    .from("secret_shares")
    .select(
      `
            id,
            created_at,
            secrets (
                *
            )
        `,
    )
    .eq("user_id", user.id);

  if (sharedSecretsError) {
    console.error(
      `[ProjectPage] Error fetching shared secrets:`,
      sharedSecretsError,
    );
  }

  // Filter shared secrets for this project
  const filteredSharedSecrets =
    sharedSecrets?.filter(
      (share) =>
        (
          share.secrets as unknown as {
            project_id: string;
            environment_id: string;
          }
        ).project_id === id &&
        (
          share.secrets as unknown as {
            project_id: string;
            environment_id: string;
          }
        ).environment_id === activeEnvironment.id,
    ) || [];

  // For owners/editors, we need to check which secrets are actually shared with others
  let sharedSecretIds = new Set<string>();
  if (role === "owner" || role === "editor") {
    // Fetch all shares for secrets in this project to see which ones are shared
    const { data: allShares } = await supabase
      .from("secret_shares")
      .select("secret_id")
      .in("secret_id", secrets?.map((s) => s.id) || []);

    sharedSecretIds = new Set(allShares?.map((s) => s.secret_id) || []);
  }

  // Combine secrets and shared secrets, deduplicating by id
  const secretsMap = new Map();

  // Add owned secrets
  secrets?.forEach((secret) => {
    secretsMap.set(secret.id, {
      ...secret,
      isShared: sharedSecretIds.has(secret.id),
    });
  });

  // Add shared secrets (for viewers), marking as not shared from their perspective
  filteredSharedSecrets?.forEach((share) => {
    const secret = share.secrets as unknown as {
      id: string;
      [key: string]: unknown;
    };
    if (!secretsMap.has(secret.id)) {
      secretsMap.set(secret.id, {
        ...secret,
        isShared: false, // Viewers don't see "shared" indicator
        sharedAt: share.created_at,
      });
    }
  });

  const allSecrets = Array.from(secretsMap.values());

  // Transform to match local store format and decrypt values
  const { decrypt } = await import("@/lib/utils/encryption");

  // Helper function to check if a value looks like encrypted data (base64)
  const isEncrypted = (value: string): boolean => {
    // Encrypted values are base64 strings with a minimum length
    // Base64 pattern: only contains A-Z, a-z, 0-9, +, /, and = for padding
    if (value.startsWith("v1:")) return true;
    const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
    return value.length > 40 && base64Pattern.test(value);
  };

  // Fetch user details for creators and updaters
  const userIds = new Set<string>();
  allSecrets?.forEach((s) => {
    if (s.user_id) userIds.add(s.user_id);
    if (s.last_updated_by) userIds.add(s.last_updated_by);
  });

  const userMap = new Map<
    string,
    { email: string; id: string; avatar?: string; username?: string }
  >();
  if (userIds.size > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const adminSupabase = createAdminClient();
    const { data: profiles } = await adminSupabase
      .from("profiles")
      .select("id, username")
      .in("id", Array.from(userIds));
    const usernameById = new Map<string, string>(
      (profiles || []).map((p) => [p.id, p.username]),
    );
    await Promise.all(
      Array.from(userIds).map(async (uid) => {
        const { data } = await adminSupabase.auth.admin.getUserById(uid);
        if (data?.user) {
          userMap.set(uid, {
            id: uid,
            email: data.user.email || "",
            avatar:
              data.user.user_metadata?.avatar_url ||
              data.user.user_metadata?.picture ||
              undefined,
            username: usernameById.get(uid) || undefined,
          });
        }
      }),
    );
  }

  const transformedProject = {
    id: project.id,
    name: project.name,
    slug: project.slug,
    user_id: project.user_id,
    agent_access_enabled: project.agent_access_enabled,
    github_repo_full_name: project.github_repo_full_name ?? null,
    ui_mode: project.ui_mode || "simple",
    default_environment_slug:
      project.default_environment_slug || activeEnvironment.slug,
    active_environment_slug: activeEnvironment.slug,
    environments: envList.map((env) => ({
      id: env.id,
      slug: env.slug,
      name: env.name,
      is_default: env.is_default,
      can_access:
        !allowedEnvironments || allowedEnvironments.includes(env.slug),
    })),
    createdAt: project.created_at,
    role: role,
    variables: await Promise.all(
      (allSecrets || []).map(async (secret) => {
        let decryptedValue = secret.value;

        // Only try to decrypt if it looks like encrypted data
        if (isEncrypted(secret.value)) {
          try {
            decryptedValue = await decrypt(secret.value);

            // [READ-REPAIR] Check if rotation is needed
            // We do this asynchronously to avoid blocking the UI,
            // but we must ensure we don't cause race conditions if multiple users access.
            // Ideally this should be a fire-and-forget server action, but here we can just check.

            // Optimization: We need to know the Active Key ID.
            // We can fetch it once per page load.
          } catch (error) {
            // If decryption fails, log error and keep original value
            console.error(
              `Failed to decrypt value for key: ${secret.key}`,
              error,
            );
          }
        }

        const creatorSnapshotId =
          (secret.created_by_user_id_snapshot as string | undefined) ||
          secret.user_id ||
          undefined;
        const creatorFromMap = creatorSnapshotId
          ? userMap.get(creatorSnapshotId)
          : undefined;
        const creator = secret.user_id
          ? secret.created_by_name || secret.created_by_email
            ? {
                id:
                  (secret.created_by_user_id_snapshot as string | undefined) ||
                  secret.user_id,
                email: (secret.created_by_email as string | undefined) || "",
                username: normalizeActorName(
                  (secret.created_by_name as string | undefined) || undefined,
                ),
                avatar: creatorFromMap?.avatar,
              }
            : creatorFromMap
          : undefined;

        const updaterSnapshotId =
          (secret.last_updated_by_user_id_snapshot as string | undefined) ||
          secret.last_updated_by ||
          undefined;
        const updaterFromMap = updaterSnapshotId
          ? userMap.get(updaterSnapshotId)
          : undefined;
        const updater =
          updaterSnapshotId ||
          secret.last_updated_by_name ||
          secret.last_updated_by_email
            ? secret.last_updated_by_name || secret.last_updated_by_email
              ? {
                  id: updaterSnapshotId || "",
                  email:
                    (secret.last_updated_by_email as string | undefined) || "",
                  username: normalizeActorName(
                    (secret.last_updated_by_name as string | undefined) ||
                      undefined,
                  ),
                  avatar: updaterFromMap?.avatar,
                }
              : updaterFromMap
            : undefined;

        return {
          id: secret.id,
          key: secret.key,
          value: decryptedValue,
          lastUpdatedBy: secret.last_updated_by,
          lastUpdatedAt: secret.last_updated_at,
          isShared: secret.isShared || false,
          sharedAt: secret.sharedAt,
          userInfo: {
            creator,
            updater,
          },
        };
      }),
    ),
    secretCount: allSecrets?.length || 0,
  };

  // [READ-REPAIR] Post-Process: Trigger rotation for outdated secrets
  const { getActiveKeyId, reEncryptSecret, needsSecretRotation } =
    await import("@/lib/utils/encryption");

  // We fetch the active key ID once
  let activeKeyId = "";
  try {
    activeKeyId = await getActiveKeyId();
  } catch {
    // If no active key (e.g. not initialized), we can't rotate. Ignore.
  }

  if (activeKeyId) {
    // Identify secrets that need rotation
    const outdatedSecrets = (allSecrets || []).filter((s) =>
      needsSecretRotation(s.value, activeKeyId),
    );

    if (outdatedSecrets.length > 0) {
      // Fire-and-Forget Rotation
      (async () => {
        try {
          // Process rotation sequentially or in parallel? Parallel is fine.
          const rotationPromises = outdatedSecrets.map(async (s) => {
            try {
              const newValue = await reEncryptSecret(s.value);
              const newKeyId = newValue.split(":")[1];

              // Use RPC to bypass RLS for rotation (if user has VIEW access)
              const { error } = await supabase.rpc("rotate_secret", {
                p_secret_id: s.id,
                p_new_value: newValue,
                p_new_key_id: newKeyId,
              });

              if (error) {
                console.error(`[Read-Repair] Failed to rotate ${s.id}`, error);
              } else {
                // Success
              }
            } catch (e) {
              console.error(`Failed to re-encrypt secret ${s.id}`, e);
            }
          });

          await Promise.all(rotationPromises);
          console.log(
            `[Read-Repair] Triggered rotation for ${outdatedSecrets.length} secrets`,
          );
        } catch (err) {
          console.error("[Read-Repair] Global error:", err);
        }
      })();
    }
  }

  return <ProjectDetailView project={transformedProject} />;
}

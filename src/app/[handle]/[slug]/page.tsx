import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import ProjectDetailView from "@/components/editor/project-detail-view";
import { getProjectEnvironments } from "@/lib/cli-environments";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ handle: string; slug: string }>;
  searchParams: Promise<{ env?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { handle, slug } = await params;
  let title = slug;

  try {
    const adminSupabase = createAdminClient();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("username", handle)
      .single();

    if (profile?.id) {
      const { data } = await adminSupabase
        .from("projects")
        .select("name")
        .eq("slug", slug)
        .eq("user_id", profile.id)
        .single();

      if (data?.name) {
        title = data.name;
      }
    }
  } catch {
    // Fallback to slug
  }

  return {
    title: `${title} by @${handle}`,
    description: `Manage secrets and environment variables for ${title}`,
    openGraph: {
      siteName: "Envault",
      images: [
        `/api/og?title=${encodeURIComponent(title)}&section=${encodeURIComponent("@" + handle)}&description=${encodeURIComponent("Shared Envault project")}`,
      ],
    },
  };
}

export default async function SharedProjectPage({
  params,
  searchParams,
}: PageProps) {
  const { handle, slug } = await params;
  const query = await searchParams;
  const requestedEnvSlug = query?.env;

  // Kick off auth + profile lookup in parallel - both are independent
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const [
    {
      data: { user },
    },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("id").eq("username", handle).single(),
  ]);

  if (!user) {
    redirect(`/login`);
  }

  if (profileError || !profile) {
    notFound();
  }

  const ownerId = profile.id;

  // Redirect owners to their own cleaner route
  if (ownerId === user.id) {
    redirect(`/project/${slug}`);
  }

  // Fetch project (needs ownerId, so can't be earlier - but use admin to bypass RLS)
  const { data: project, error: _projectError } = await adminSupabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .eq("user_id", ownerId)
    .single();

  const id = project?.id;

  if (_projectError || !project) {
    notFound();
  }

  // Get role (needs project.id)
  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, id, user.id);

  if (!role) {
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

  // Fetch secrets + sharedSecrets in parallel (both need project.id)
  const [
    { data: secretsData, error: secretsError },
    { data: sharedSecrets, error: sharedSecretsError },
  ] = await Promise.all([
    hasActiveEnvironmentAccess
      ? supabase
          .from("secrets")
          .select("*")
          .eq("project_id", id)
          .eq("environment_id", activeEnvironment.id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("secret_shares")
      .select(`id, created_at, secrets (*)`)
      .eq("user_id", user.id),
  ]);

  const secrets = secretsData || [];

  if (secretsError)
    console.error(`[SharedProjectPage] secrets error:`, secretsError);
  if (sharedSecretsError)
    console.error(
      `[SharedProjectPage] sharedSecrets error:`,
      sharedSecretsError,
    );

  // Filter shared secrets belonging to this project
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

  // For owners/editors: which secrets are already shared with others?
  let sharedSecretIds = new Set<string>();
  if (
    (role === "owner" || role === "editor") &&
    secrets &&
    secrets.length > 0
  ) {
    const { data: allShares } = await supabase
      .from("secret_shares")
      .select("secret_id")
      .in(
        "secret_id",
        secrets.map((s) => s.id),
      );
    sharedSecretIds = new Set(allShares?.map((s) => s.secret_id) || []);
  }

  // Deduplicate secrets (owned + shared)
  const secretsMap = new Map();
  secrets?.forEach((secret) => {
    secretsMap.set(secret.id, {
      ...secret,
      isShared: sharedSecretIds.has(secret.id),
    });
  });
  filteredSharedSecrets?.forEach((share) => {
    const secret = share.secrets as unknown as {
      id: string;
      [key: string]: unknown;
    };
    if (!secretsMap.has(secret.id)) {
      secretsMap.set(secret.id, {
        ...secret,
        isShared: false,
        sharedAt: share.created_at,
      });
    }
  });

  const allSecrets = Array.from(secretsMap.values());

  // Collect unique user IDs, then batch-fetch from admin (all in parallel)
  const userIds = new Set<string>();
  allSecrets.forEach((s) => {
    if (s.user_id) userIds.add(s.user_id);
    if (s.last_updated_by) userIds.add(s.last_updated_by);
  });

  const userMap = new Map<
    string,
    { email: string; id: string; avatar?: string; username?: string }
  >();
  if (userIds.size > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

  // Decrypt + transform (in parallel)
  const { decrypt } = await import("@/lib/encryption");
  const isEncrypted = (value: string): boolean => {
    if (value.startsWith("v1:")) return true;
    const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
    return value.length > 40 && base64Pattern.test(value);
  };

  const transformedProject = {
    id: project.id,
    name: project.name,
    slug: project.slug,
    user_id: project.user_id,
    github_installation_id: project.github_installation_id ?? null,
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
    owner_username: handle,
    createdAt: project.created_at,
    role,
    variables: await Promise.all(
      allSecrets.map(async (secret) => {
        let decryptedValue = secret.value;
        if (isEncrypted(secret.value)) {
          try {
            decryptedValue = await decrypt(secret.value);
          } catch (error) {
            console.error(`Failed to decrypt key: ${secret.key}`, error);
          }
        }

        const creatorFromMap = secret.user_id
          ? userMap.get(secret.user_id)
          : undefined;
        const updaterFromMap = secret.last_updated_by
          ? userMap.get(secret.last_updated_by)
          : undefined;
        const updaterSnapshotId =
          (secret.last_updated_by_user_id_snapshot as string | undefined) ||
          secret.last_updated_by ||
          undefined;

        return {
          id: secret.id,
          key: secret.key,
          value: decryptedValue,
          lastUpdatedBy: secret.last_updated_by,
          lastUpdatedAt: secret.last_updated_at,
          isShared: secret.isShared || false,
          sharedAt: secret.sharedAt,
          userInfo: {
            creator: secret.user_id
              ? secret.created_by_name || secret.created_by_email
                ? {
                    id:
                      (secret.created_by_user_id_snapshot as
                        | string
                        | undefined) || secret.user_id,
                    email:
                      (secret.created_by_email as string | undefined) || "",
                    username:
                      (secret.created_by_name as string | undefined) ||
                      undefined,
                    avatar: creatorFromMap?.avatar,
                  }
                : creatorFromMap
              : undefined,
            updater:
              updaterSnapshotId ||
              secret.last_updated_by_name ||
              secret.last_updated_by_email
                ? secret.last_updated_by_name || secret.last_updated_by_email
                  ? {
                      id: updaterSnapshotId || "",
                      email:
                        (secret.last_updated_by_email as string | undefined) ||
                        "",
                      username:
                        (secret.last_updated_by_name as string | undefined) ||
                        undefined,
                      avatar: updaterFromMap?.avatar,
                    }
                  : updaterFromMap
                : undefined,
          },
        };
      }),
    ),
    secretCount: allSecrets.length,
  };

  return <ProjectDetailView project={transformedProject} />;
}

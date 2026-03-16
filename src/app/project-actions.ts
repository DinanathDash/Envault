"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getProjectEnvironments } from "@/lib/cli-environments";
import { headers } from "next/headers";
import { writeRateLimit } from "@/lib/ratelimit";
import { logAuditEvent } from "@/lib/audit-logger";

type ProjectUIMode = "simple" | "advanced";

async function resolveProjectEnvironmentForUI(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  environmentSlug?: string,
) {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("default_environment_slug, ui_mode")
    .eq("id", projectId)
    .single();

  const preferredSlug =
    environmentSlug || project?.default_environment_slug || "development";
  const environments = await getProjectEnvironments(admin, projectId);
  const preferredEnv =
    environments.find((env) => env.slug === preferredSlug) ||
    environments.find((env) => env.is_default) ||
    environments[0];

  if (preferredEnv) {
    return {
      id: preferredEnv.id,
      slug: preferredEnv.slug,
      uiMode: (project?.ui_mode as ProjectUIMode) || "simple",
    };
  }
  return null;
}

async function touchProjectActivity(projectId: string) {
  const admin = createAdminClient();

  await admin
    .from("projects")
    .update({ last_updated_at: new Date().toISOString() })
    .eq("id", projectId);

  const [{ data: project }, { data: members }] = await Promise.all([
    admin.from("projects").select("user_id").eq("id", projectId).maybeSingle(),
    admin.from("project_members").select("user_id").eq("project_id", projectId),
  ]);

  const userIds = new Set<string>();
  if (project?.user_id) userIds.add(project.user_id);
  (members || []).forEach((member) => {
    if (member.user_id) userIds.add(member.user_id);
  });

  const { cacheDel, CacheKeys, invalidateProjectCaches } =
    await import("@/lib/cache");

  await Promise.all([
    ...Array.from(userIds).map((userId) =>
      cacheDel(CacheKeys.userProjects(userId)),
    ),
    invalidateProjectCaches(projectId),
  ]);
}

async function getActorIdentitySnapshot(userId: string, fallbackEmail: string) {
  const admin = createAdminClient();

  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("username").eq("id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  const email = authUser?.user?.email || fallbackEmail || "";
  const metadata = authUser?.user?.user_metadata || {};
  const usernameFromProfile =
    profile && typeof profile.username === "string" ? profile.username : "";
  const usernameFromMetadata =
    typeof metadata.username === "string"
      ? metadata.username
      : typeof metadata.name === "string"
        ? metadata.name
        : "";

  const name =
    usernameFromProfile ||
    usernameFromMetadata ||
    email.split("@")[0] ||
    `user-${userId.slice(0, 8)}`;

  return {
    id: userId,
    name,
    email,
  };
}

export async function createProject(
  name: string,
  options?: {
    uiMode?: ProjectUIMode;
    defaultEnvironmentSlug?: "development" | "preview" | "production";
  },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await writeRateLimit.limit(
    `create_proj_${ip}`,
  );
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  // Check if a project with the same name already exists for this user (case-insensitive)
  const { data: existingProject } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", name.trim())
    .maybeSingle();

  if (existingProject) {
    return {
      error: `A project named "${name}" already exists. Please use a different name.`,
    };
  }

  const slugBase =
    name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";

  // We need to ensure the slug is unique for this user
  let finalSlug = slugBase;
  let counter = 1;
  while (true) {
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .eq("slug", finalSlug)
      .maybeSingle();

    if (!existing) break;
    finalSlug = `${slugBase}-${counter}`;
    counter++;
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      slug: finalSlug,
      ui_mode: options?.uiMode || "simple",
      default_environment_slug:
        options?.defaultEnvironmentSlug || "development",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating project:", error);
    return { error: error.message };
  }

  // Invalidate user's project list cache
  const { cacheDel, CacheKeys } = await import("@/lib/cache");
  await cacheDel(CacheKeys.userProjects(user.id));

  revalidatePath("/dashboard");
  return { data };
}

export async function renameProject(id: string, newName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await writeRateLimit.limit(
    `rename_proj_${ip}`,
  );
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  // Permission Check: Owner Only
  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, id, user.id);

  if (role !== "owner") {
    return { error: "Unauthorized: Only the owner can rename a project." };
  }

  const slugBase =
    newName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";

  // We need to ensure the slug is unique for this user
  let finalSlug = slugBase;
  let counter = 1;
  while (true) {
    // Exclude the current project from the uniqueness check so you don't conflict with yourself
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .eq("slug", finalSlug)
      .neq("id", id)
      .maybeSingle();

    if (!existing) break;
    finalSlug = `${slugBase}-${counter}`;
    counter++;
  }

  const { data, error } = await supabase
    .from("projects")
    .update({
      name: newName,
      slug: finalSlug,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error renaming project:", error);
    return { error: error.message };
  }

  // Invalidate user's project list cache and specific project cache
  const { cacheDel, CacheKeys, invalidateProjectCaches } =
    await import("@/lib/cache");
  await cacheDel(CacheKeys.userProjects(user.id));
  await invalidateProjectCaches(id);

  // Fire-and-forget project activity email
  {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: userData } = await admin.auth.admin.getUserById(user.id);
    const userEmail = userData?.user?.email;
    if (userEmail) {
      const { sendProjectActivityEmail } = await import("@/lib/email");
      sendProjectActivityEmail(
        userEmail,
        data.name,
        `Project Renamed: ${data.name}`,
        `Your project has been renamed to "${data.name}"`,
        data.id,
        user.id,
      ).catch(() => {});
    }
  }

  revalidatePath("/dashboard");
  return { data };
}

export async function getProjects(bypassCache: boolean = false) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check cache first
  const { cacheGet, cacheSet, CacheKeys, CACHE_TTL } =
    await import("@/lib/cache");
  const cacheKey = CacheKeys.userProjects(user.id);

  if (!bypassCache) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cachedProjects = await cacheGet<any[]>(cacheKey);
    if (cachedProjects !== null) {
      // Stale check: if first project uses old snake_case or missing createdAt
      const isStale =
        cachedProjects.length > 0 &&
        (!cachedProjects[0].createdAt ||
          !("slug" in cachedProjects[0]) ||
          !("owner_username" in cachedProjects[0]) ||
          "created_at" in cachedProjects[0] ||
          "secrets" in cachedProjects[0]);
      if (!isStale) {
        return { data: cachedProjects };
      }
    }
  }

  // Step 1: Fetch projects only
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  if (!projects || projects.length === 0) {
    await cacheSet(cacheKey, [], CACHE_TTL.PROJECT_LIST);
    return { data: [] };
  }

  // Step 1.5: Fetch projects with shared secrets for this user
  // First, get project IDs that have shared secrets
  const { data: sharedProjectIdsData } = await supabase
    .from("secret_shares")
    .select("secrets!inner(project_id)")
    .eq("user_id", user.id);

  const sharedProjectIds = [
    ...new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sharedProjectIdsData?.map((s) => (s.secrets as any).project_id) || [],
    ),
  ];

  // Fetch shared projects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharedProjects: any[] = [];
  if (sharedProjectIds.length > 0) {
    const { data: sharedProjs } = await supabase
      .from("projects")
      .select("*")
      .in("id", sharedProjectIds);
    sharedProjects = sharedProjs || [];
  }

  // Add shared projects that aren't already in the projects list
  const allProjects = [...projects];
  sharedProjects.forEach((sharedProject) => {
    if (!projects.find((p) => p.id === sharedProject.id)) {
      allProjects.push(sharedProject);
    }
  });

  // Step 2: Fetch secrets for each project
  const projectIds = allProjects.map((p) => p.id);
  const { data: projectSecrets } = await supabase
    .from("secrets")
    .select("id, project_id, environment_id")
    .in("project_id", projectIds);

  // Create count and grouping maps
  const secretCountMap = new Map<string, number>();
  const projectSecretMap = new Map<
    string,
    Array<{ id: string; environment_id: string }>
  >();
  projectSecrets?.forEach((s) => {
    secretCountMap.set(
      s.project_id,
      (secretCountMap.get(s.project_id) || 0) + 1,
    );
    const grouped = projectSecretMap.get(s.project_id) || [];
    grouped.push({ id: s.id, environment_id: s.environment_id });
    projectSecretMap.set(s.project_id, grouped);
  });

  // Step 3: Fetch project members for current user
  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id, role, allowed_environments")
    .in("project_id", projectIds)
    .eq("user_id", user.id);

  // Create membership map
  const membershipMap = new Map<
    string,
    {
      role: "owner" | "editor" | "viewer";
      allowed_environments: string[] | null;
    }
  >(
    memberships?.map((m) => [
      m.project_id,
      {
        role: (m.role as "owner" | "editor" | "viewer") || "viewer",
        allowed_environments: m.allowed_environments || null,
      },
    ]) || [],
  );

  // Step 3.5: Check if projects are shared (for owners)
  // Fetch all members for owned projects
  const ownedProjectIds = allProjects
    .filter((p) => p.user_id === user.id)
    .map((p) => p.id);
  const sharedStatusMap = new Map<string, boolean>();

  if (ownedProjectIds.length > 0) {
    // Check for project members
    const { data: allMembers } = await supabase
      .from("project_members")
      .select("project_id")
      .in("project_id", ownedProjectIds);

    // Check for shared secrets
    const { data: sharedSecrets } = await supabase
      .from("secret_shares")
      .select("secrets!inner(project_id)")
      .in("secrets.project_id", ownedProjectIds);

    // Mark projects as shared if they have members or shared secrets
    ownedProjectIds.forEach((projectId) => {
      const hasMembers =
        allMembers?.some((m) => m.project_id === projectId) || false;
      const hasSharedSecrets =
        sharedSecrets?.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (s) => (s.secrets as any).project_id === projectId,
        ) || false;
      sharedStatusMap.set(projectId, hasMembers || hasSharedSecrets);
    });
  }

  // Step 3.75: Fetch Owner Usernames from 'profiles'
  // We need to resolve the 'username' for every unique 'user_id' in allProjects
  const uniqueOwnerIds = [...new Set(allProjects.map((p) => p.user_id))];
  const { data: ownerProfiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", uniqueOwnerIds);

  const ownerUsernameMap = new Map<string, string>();
  ownerProfiles?.forEach((profile) => {
    ownerUsernameMap.set(profile.id, profile.username);
  });

  // Step 3.8: Fetch project environments
  const { data: allEnvironments } = await supabase
    .from("project_environments")
    .select("id, project_id, name, slug, is_default");

  // Group environments by project
  const environmentMap = new Map<
    string,
    Array<{ id: string; slug: string; name: string; is_default: boolean }>
  >();
  const environmentSlugByIdMap = new Map<string, string>();

  if (allEnvironments) {
    allEnvironments.forEach((env) => {
      const projEnvs = environmentMap.get(env.project_id) || [];
      projEnvs.push(env);
      environmentMap.set(env.project_id, projEnvs);
      environmentSlugByIdMap.set(env.id, env.slug);
    });
  }

  // Step 3.9: Fetch per-user shared secret ids for shared projects
  const { data: userSecretShares } = await supabase
    .from("secret_shares")
    .select("secret_id, secrets!inner(project_id)")
    .eq("user_id", user.id)
    .in("secrets.project_id", projectIds);

  const sharedSecretIdMap = new Map<string, Set<string>>();
  userSecretShares?.forEach((share) => {
      const secretRelation = share.secrets as
        | { project_id?: string }
        | Array<{ project_id?: string }>
        | null;
      const secret = Array.isArray(secretRelation)
        ? secretRelation[0]
        : secretRelation;
    const projectId = secret?.project_id as string | undefined;
    if (!projectId) return;
    const ids = sharedSecretIdMap.get(projectId) || new Set<string>();
    ids.add(share.secret_id);
    sharedSecretIdMap.set(projectId, ids);
  });

  // Step 4: Enrich projects with the data
  const enrichedProjects = allProjects.map((p) => {
    let role: "owner" | "editor" | "viewer" = "viewer";
    if (p.user_id === user.id) {
      role = "owner";
    } else if (membershipMap.has(p.id)) {
      role = membershipMap.get(p.id)?.role || "viewer";
    }

    const totalCount = secretCountMap.get(p.id) || 0;
    let count = totalCount;
    if (p.user_id !== user.id) {
      const accessibleSecretIds = new Set<string>(
        sharedSecretIdMap.get(p.id) || [],
      );
      const membership = membershipMap.get(p.id);

      if (membership) {
        const projectSecretsForProject = projectSecretMap.get(p.id) || [];
        const allowedEnvironments = membership.allowed_environments;

        if (allowedEnvironments && allowedEnvironments.length > 0) {
          const allowedSet = new Set(allowedEnvironments);
          projectSecretsForProject.forEach((secret) => {
            const envSlug = environmentSlugByIdMap.get(secret.environment_id);
            if (envSlug && allowedSet.has(envSlug)) {
              accessibleSecretIds.add(secret.id);
            }
          });
        } else {
          projectSecretsForProject.forEach((secret) => {
            accessibleSecretIds.add(secret.id);
          });
        }
      }

      count = accessibleSecretIds.size;
    }

    // For the owner: isShared means they have shared it with others
    // For non-owners: isShared must always be true so ProjectCard routes to /[owner_username]/[slug]
    const isShared =
      p.user_id === user.id ? sharedStatusMap.get(p.id) || false : true; // Non-owned projects are always "shared" from the viewer's perspective

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      user_id: p.user_id,
      ui_mode: p.ui_mode || "simple",
      default_environment_slug: p.default_environment_slug || "development",
      owner_username: ownerUsernameMap.get(p.user_id) || null,
      createdAt: p.last_updated_at || p.created_at || new Date().toISOString(), // Activity timestamp for dashboard card
      secretCount: count,
      variables: [],
      role,
      isShared,
      environments: environmentMap.get(p.id) || [
        {
          id: "dev-fallback",
          slug: "development",
          name: "Development",
          is_default: true,
        },
        {
          id: "prev-fallback",
          slug: "preview",
          name: "Preview",
          is_default: false,
        },
        {
          id: "prod-fallback",
          slug: "production",
          name: "Production",
          is_default: false,
        },
      ],
    };
  });

  // Cache the enriched projects
  await cacheSet(cacheKey, enrichedProjects, CACHE_TTL.PROJECT_LIST);

  return { data: enrichedProjects };
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await writeRateLimit.limit(
    `delete_proj_${ip}`,
  );
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  // Permission Check: Owner Only
  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, id, user.id);

  if (role !== "owner") {
    return { error: "Unauthorized: Only the owner can delete a project." };
  }

  const { error } = await supabase.from("projects").delete().eq("id", id);
  // We rely on RLS and the permission check above.
  // strictly ensuring only ID match is fine if we validated ownership.

  if (error) {
    return { error: error.message };
  }

  // Invalidate caches for owner and all members
  const { cacheDel, CacheKeys, invalidateProjectCaches } =
    await import("@/lib/cache");
  await cacheDel(CacheKeys.userProjects(user.id));
  await invalidateProjectCaches(id);

  revalidatePath("/dashboard");
  return { success: true };
}

export async function addVariable(
  projectId: string,
  key: string,
  value: string,
  environmentSlug?: string,
) {
  const supabase = await createClient();

  // Input Validation
  const { SecretSchema } = await import("@/lib/schemas");
  const validation = SecretSchema.safeParse({ key, value });
  if (!validation.success) {
    return {
      error:
        validation.error.flatten().fieldErrors?.key?.[0] ||
        validation.error.flatten().fieldErrors?.value?.[0] ||
        "Invalid input",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const actorSnapshot = await getActorIdentitySnapshot(
    user.id,
    user.email || "",
  );

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await writeRateLimit.limit(
    `add_var_${ip}`,
  );
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  // Permission Check: Owner or Editor
  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, projectId, user.id);

  if (role !== "owner" && role !== "editor") {
    return {
      error: "Unauthorized: You do not have permission to add variables.",
    };
  }

  // Import encryption utility
  const { encrypt } = await import("@/lib/encryption");
  const environment = await resolveProjectEnvironmentForUI(
    supabase,
    projectId,
    environmentSlug,
  );
  if (!environment) {
    return { error: "No environment configured for this project." };
  }

  // Encrypt the value before storing
  const encryptedValue = await encrypt(value);

  // Extract key_id from encrypted format: v1:key_id:ciphertext
  const keyId = encryptedValue.split(":")[1];

  const { data, error } = await supabase
    .from("secrets")
    .insert({
      user_id: user.id, // Creator
      created_by_user_id_snapshot: actorSnapshot.id,
      created_by_name: actorSnapshot.name,
      created_by_email: actorSnapshot.email,
      project_id: projectId,
      environment_id: environment.id,
      key,
      value: encryptedValue,
      key_id: keyId,
      last_updated_by: user.id,
      last_updated_by_user_id_snapshot: actorSnapshot.id,
      last_updated_by_name: actorSnapshot.name,
      last_updated_by_email: actorSnapshot.email,
      last_updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding variable:", error);
    return { error: error.message };
  }

  // Fire-and-forget project activity email
  {
    const { data: projectData } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .single();
    if (projectData) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: userData } = await admin.auth.admin.getUserById(user.id);
      const userEmail = userData?.user?.email;
      if (userEmail) {
        const { sendProjectActivityEmail } = await import("@/lib/email");
        sendProjectActivityEmail(
          userEmail,
          projectData.name,
          "Secret Added",
          `A new secret <strong>${key}</strong> was added to <strong>${projectData.name}</strong>`,
          projectData.id,
          user.id,
        ).catch(() => {});
      }
    }
  }

  await logAuditEvent({
    projectId,
    actorId: user.id,
    actorType: "user",
    action: "secret.created",
    targetResourceId: data.id,
    metadata: {
      key_name: key,
      environment: environment.slug,
      beneficiary_user_id: user.id,
    },
  });

  await touchProjectActivity(projectId);

  revalidatePath("/project/[slug]", "page");
  return { data };
}

export async function updateVariable(
  id: string,
  projectId: string,
  updates: { key?: string; value?: string },
  environmentSlug?: string,
) {
  const supabase = await createClient();

  // Input Validation - use partial schema since both are optional in the type
  if (updates.key || updates.value) {
    const { SecretSchema } = await import("@/lib/schemas");
    // Merge with dummy data for safe parsing of partials if needed, or parse partial
    const validation = SecretSchema.partial().safeParse(updates);
    if (!validation.success) {
      return {
        error:
          validation.error.flatten().fieldErrors?.key?.[0] ||
          validation.error.flatten().fieldErrors?.value?.[0] ||
          "Invalid input",
      };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const actorSnapshot = await getActorIdentitySnapshot(
    user.id,
    user.email || "",
  );

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await writeRateLimit.limit(
    `update_var_${ip}`,
  );
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  // Permission Check: Owner or Editor
  // Note: Technically we should check if they can access THIS specific secret too?
  // `getProjectRole` covers project-level access.
  // If we support Granular Shares having "Edit" rights (unlikely? usually Read Only), we'd check that here.
  // For now, only Project Editors/Owners can update.
  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, projectId, user.id);

  if (role !== "owner" && role !== "editor") {
    return {
      error: "Unauthorized: You do not have permission to update variables.",
    };
  }
  const environment = await resolveProjectEnvironmentForUI(
    supabase,
    projectId,
    environmentSlug,
  );
  if (!environment) {
    return { error: "No environment configured for this project." };
  }

  const { data: existingSecret, error: existingSecretError } = await supabase
    .from("secrets")
    .select("key")
    .eq("id", id)
    .eq("environment_id", environment.id)
    .maybeSingle();

  if (existingSecretError) {
    return { error: existingSecretError.message };
  }

  if (!existingSecret) {
    return { error: "Secret not found." };
  }

  // If updating the value, encrypt it first
  const finalUpdates: Record<string, unknown> = {
    ...updates,
    last_updated_by: user.id,
    last_updated_by_user_id_snapshot: actorSnapshot.id,
    last_updated_by_name: actorSnapshot.name,
    last_updated_by_email: actorSnapshot.email,
    last_updated_at: new Date().toISOString(),
  };

  if (updates.value) {
    const { encrypt } = await import("@/lib/encryption");
    finalUpdates.value = await encrypt(updates.value);
    // Extract key_id
    finalUpdates.key_id = (finalUpdates.value as string).split(":")[1];
  }

  const { error } = await supabase
    .from("secrets")
    .update(finalUpdates)
    .eq("id", id)
    .eq("environment_id", environment.id);
  // Remove .eq('user_id') because editors can update secrets they didn't create

  if (error) {
    return { error: error.message };
  }

  // Fire-and-forget project activity email
  {
    const { data: projectData } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .single();
    if (projectData) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: userData } = await admin.auth.admin.getUserById(user.id);
      const userEmail = userData?.user?.email;
      if (userEmail) {
        const { sendProjectActivityEmail } = await import("@/lib/email");
        sendProjectActivityEmail(
          userEmail,
          projectData.name,
          "Secret Updated",
          `A secret was updated in <strong>${projectData.name}</strong>`,
          projectData.id,
          user.id,
        ).catch(() => {});
      }
    }
  }

  const changes: Record<string, { old: string; new: string }> = {};
  if (typeof updates.key === "string" && updates.key !== existingSecret.key) {
    changes.key_name = {
      old: existingSecret.key,
      new: updates.key,
    };
  }
  if (typeof updates.value === "string") {
    changes.value = {
      old: "[REDACTED]",
      new: "[REDACTED]",
    };
  }

  await logAuditEvent({
    projectId,
    actorId: user.id,
    actorType: "user",
    action: "secret.updated",
    targetResourceId: id,
    metadata: {
      key_name: updates.key ?? existingSecret.key,
      environment: environment.slug,
      beneficiary_user_id: user.id,
      ...(Object.keys(changes).length > 0 ? { changes } : {}),
    },
  });

  await touchProjectActivity(projectId);

  revalidatePath("/project/[slug]", "page");
  return { success: true };
}

export async function deleteVariable(
  id: string,
  projectId: string,
  environmentSlug?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await writeRateLimit.limit(
    `delete_var_${ip}`,
  );
  if (!rateLimitSuccess) {
    return { error: "Too many requests. Please try again later." };
  }

  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, projectId, user.id);

  if (role !== "owner" && role !== "editor") {
    return {
      error: "Unauthorized: You do not have permission to delete variables.",
    };
  }

  const environment = await resolveProjectEnvironmentForUI(
    supabase,
    projectId,
    environmentSlug,
  );
  if (!environment) {
    return { error: "No environment configured for this project." };
  }

  const { data: deletedSecret, error } = await supabase
    .from("secrets")
    .delete()
    .eq("id", id)
    .eq("environment_id", environment.id)
    .select("id, key")
    .maybeSingle();
  // Remove .eq('user_id')

  if (error) {
    return { error: error.message };
  }

  if (!deletedSecret) {
    return { error: "Secret not found." };
  }

  // Fire-and-forget project activity email
  {
    const { data: projectData } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .single();
    if (projectData) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: userData } = await admin.auth.admin.getUserById(user.id);
      const userEmail = userData?.user?.email;
      if (userEmail) {
        const { sendProjectActivityEmail } = await import("@/lib/email");
        sendProjectActivityEmail(
          userEmail,
          projectData.name,
          "Secret Deleted",
          `A secret was deleted from <strong>${projectData.name}</strong>`,
          projectData.id,
          user.id,
        ).catch(() => {});
      }
    }
  }

  await logAuditEvent({
    projectId,
    actorId: user.id,
    actorType: "user",
    action: "secret.deleted",
    targetResourceId: deletedSecret.id,
    metadata: {
      key_name: deletedSecret.key,
      environment: environment.slug,
      beneficiary_user_id: user.id,
      changes: {
        key_name: {
          old: deletedSecret.key,
          new: "[DELETED]",
        },
        value: {
          old: "[REDACTED]",
          new: "[DELETED]",
        },
      },
    },
  });

  await touchProjectActivity(projectId);

  revalidatePath("/project/[slug]", "page");
  return { success: true };
}

export interface BulkImportVariable {
  key: string;
  value: string;
}

export interface BulkImportResult {
  added: number;
  updated: number;
  skipped: number;
  error?: string;
}

export async function addVariablesBulk(
  projectId: string,
  variables: BulkImportVariable[],
  environmentSlug?: string,
): Promise<BulkImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { added: 0, updated: 0, skipped: 0, error: "Not authenticated" };
  }

  const actorSnapshot = await getActorIdentitySnapshot(
    user.id,
    user.email || "",
  );

  // Rate Limiting
  const ip = (await headers()).get("x-forwarded-for") || "unknown";
  const { success: rateLimitSuccess } = await writeRateLimit.limit(
    `bulk_var_${ip}`,
  );
  if (!rateLimitSuccess) {
    return {
      added: 0,
      updated: 0,
      skipped: 0,
      error: "Too many requests. Please try again later.",
    };
  }

  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, projectId, user.id);

  if (role !== "owner" && role !== "editor") {
    return { added: 0, updated: 0, skipped: 0, error: "Unauthorized" };
  }

  // Import encryption utilities
  const { encrypt, decrypt } = await import("@/lib/encryption");
  const environment = await resolveProjectEnvironmentForUI(
    supabase,
    projectId,
    environmentSlug,
  );
  if (!environment) {
    return {
      added: 0,
      updated: 0,
      skipped: 0,
      error: "No environment configured for this project.",
    };
  }

  // Fetch existing variables for comparison (key, value, and user_id for creator preservation)
  const { data: existingSecrets } = await supabase
    .from("secrets")
    .select("id, key, value, user_id")
    .eq("project_id", projectId)
    .eq("environment_id", environment.id);

  // Create maps for quick lookup
  const keyToSecretMap = new Map(
    (existingSecrets || []).map((s) => [
      s.key,
      { id: s.id, user_id: s.user_id, value: s.value },
    ]),
  );

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const itemsToUpsert: Array<{
    id: string;
    user_id: string;
    created_by_user_id_snapshot?: string;
    created_by_name?: string;
    created_by_email?: string;
    project_id: string;
    environment_id: string;
    key: string;
    value: string;
    key_id: string;
    last_updated_by: string;
    last_updated_by_user_id_snapshot?: string;
    last_updated_by_name?: string;
    last_updated_by_email?: string;
    last_updated_at: string;
  }> = [];

  const processVariable = async (variable: BulkImportVariable) => {
    const encryptedValue = await encrypt(variable.value);
    const keyId = encryptedValue.split(":")[1];
    const existing = keyToSecretMap.get(variable.key);

    if (!existing) {
      // New variable - add it
      added++;
      itemsToUpsert.push({
        id: crypto.randomUUID(),
        user_id: user.id,
        created_by_user_id_snapshot: actorSnapshot.id,
        created_by_name: actorSnapshot.name,
        created_by_email: actorSnapshot.email,
        project_id: projectId,
        environment_id: environment.id,
        key: variable.key,
        value: encryptedValue,
        key_id: keyId,
        last_updated_by: user.id,
        last_updated_by_user_id_snapshot: actorSnapshot.id,
        last_updated_by_name: actorSnapshot.name,
        last_updated_by_email: actorSnapshot.email,
        last_updated_at: new Date().toISOString(),
      });
    } else {
      // Variable exists - compare plaintext values (decrypt existing to compare)
      try {
        const existingPlaintext = await decrypt(existing.value);
        if (existingPlaintext === variable.value) {
          // Plaintext values are identical - skip it
          skipped++;
        } else {
          // Plaintext values differ - update it
          updated++;
          itemsToUpsert.push({
            id: existing.id,
            user_id: existing.user_id, // Preserve original creator
            project_id: projectId,
            environment_id: environment.id,
            key: variable.key,
            value: encryptedValue,
            key_id: keyId,
            last_updated_by: user.id,
            last_updated_by_user_id_snapshot: actorSnapshot.id,
            last_updated_by_name: actorSnapshot.name,
            last_updated_by_email: actorSnapshot.email,
            last_updated_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        // If decryption fails, treat as update to be safe
        console.error(
          `Failed to decrypt existing value for key ${variable.key}:`,
          error,
        );
        updated++;
        itemsToUpsert.push({
          id: existing.id,
          user_id: existing.user_id,
          project_id: projectId,
          environment_id: environment.id,
          key: variable.key,
          value: encryptedValue,
          key_id: keyId,
          last_updated_by: user.id,
          last_updated_by_user_id_snapshot: actorSnapshot.id,
          last_updated_by_name: actorSnapshot.name,
          last_updated_by_email: actorSnapshot.email,
          last_updated_at: new Date().toISOString(),
        });
      }
    }
  };

  await Promise.all(variables.map(processVariable));

  if (itemsToUpsert.length > 0) {
    const { error } = await supabase.from("secrets").upsert(itemsToUpsert);

    if (error) {
      console.error("Bulk upsert error:", error);
      return { added: 0, updated: 0, skipped: 0, error: error.message };
    }

    await touchProjectActivity(projectId);

    // Fire-and-forget project activity email summarising the import
    {
      const { data: projectData } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", projectId)
        .single();
      if (projectData) {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const { data: userData } = await admin.auth.admin.getUserById(user.id);
        const userEmail = userData?.user?.email;
        if (userEmail) {
          const parts: string[] = [];
          if (added > 0) parts.push(`${added} added`);
          if (updated > 0) parts.push(`${updated} updated`);
          const summary = parts.join(", ");
          const { sendProjectActivityEmail } = await import("@/lib/email");
          sendProjectActivityEmail(
            userEmail,
            projectData.name,
            "Bulk Import Complete",
            `Bulk import to <strong>${projectData.name}</strong> finished: ${summary}, ${skipped} unchanged.`,
            projectData.id,
            user.id,
          ).catch(() => {});
        }
      }
    }
  }

  if (added > 0) {
    await logAuditEvent({
      projectId,
      actorId: user.id,
      actorType: "user",
      action: "secret.created",
      targetResourceId: projectId,
      metadata: {
        count: added,
        added,
        updated: 0,
        skipped,
        environment: environment.slug,
        beneficiary_user_id: user.id,
      },
    });
  }

  if (updated > 0) {
    await logAuditEvent({
      projectId,
      actorId: user.id,
      actorType: "user",
      action: "secret.updated",
      targetResourceId: projectId,
      metadata: {
        count: updated,
        added: 0,
        updated,
        skipped,
        environment: environment.slug,
        beneficiary_user_id: user.id,
      },
    });
  }

  revalidatePath("/project/[slug]", "page");
  return { added, updated, skipped };
}

export async function logSecretBatchRead(
  projectId: string,
  count: number,
  environmentSlug?: string,
  source: "web_ui_download" | "cli" = "web_ui_download",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) {
    return { error: "Unauthorized" };
  }

  await logAuditEvent({
    projectId,
    actorId: user.id,
    actorType: "user",
    action: "secret.read_batch",
    targetResourceId: projectId,
    metadata: {
      count,
      source,
      environment: environmentSlug || "unknown",
      beneficiary_user_id: user.id,
    },
  });

  return { success: true };
}

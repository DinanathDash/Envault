"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { formatEnvironmentLabel } from "@/lib/environment-label";

import { cacheDel, CacheKeys, invalidateUserSecretAccess } from "@/lib/cache";
import { logAuditEvent } from "@/lib/audit-logger";

function normalizeAllowedEnvironments(
  environments: string[] | null | undefined,
): string[] | null {
  if (environments === null || environments === undefined) {
    return null;
  }
  return [...environments].sort();
}

function areAllowedEnvironmentsEqual(
  a: string[] | null | undefined,
  b: string[] | null | undefined,
): boolean {
  const normalizedA = normalizeAllowedEnvironments(a);
  const normalizedB = normalizeAllowedEnvironments(b);

  if (normalizedA === null && normalizedB === null) {
    return true;
  }

  if (normalizedA === null || normalizedB === null) {
    return false;
  }

  if (normalizedA.length !== normalizedB.length) {
    return false;
  }

  return normalizedA.every((value, index) => value === normalizedB[index]);
}

function deriveAccessChangeEvents(
  previous: string[] | null | undefined,
  next: string[] | null | undefined,
): Array<{
  action: "environment.access_granted" | "environment.access_revoked";
  old: string[] | "all";
  new: string[] | "all";
}> {
  const prev = normalizeAllowedEnvironments(previous);
  const nxt = normalizeAllowedEnvironments(next);

  if (areAllowedEnvironmentsEqual(prev, nxt)) {
    return [];
  }

  if (prev === null && nxt !== null) {
    return [
      {
        action: "environment.access_revoked",
        old: "all",
        new: nxt,
      },
    ];
  }

  if (prev !== null && nxt === null) {
    return [
      {
        action: "environment.access_granted",
        old: prev,
        new: "all",
      },
    ];
  }

  if (prev !== null && nxt !== null) {
    const prevSet = new Set(prev);
    const nextSet = new Set(nxt);
    const added = nxt.filter((env) => !prevSet.has(env));
    const removed = prev.filter((env) => !nextSet.has(env));

    const events: Array<{
      action: "environment.access_granted" | "environment.access_revoked";
      old: string[] | "all";
      new: string[] | "all";
    }> = [];

    if (added.length > 0) {
      events.push({
        action: "environment.access_granted",
        old: prev,
        new: nxt,
      });
    }

    if (removed.length > 0) {
      events.push({
        action: "environment.access_revoked",
        old: prev,
        new: nxt,
      });
    }

    return events;
  }

  return [];
}

export async function createAccessRequest(
  token: string,
  requestedEnvironment?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const projectId = token; // Assuming simplified flow where link ID = Project ID for now to start.

  // Check if project exists
  // We use Admin Client here because RLS blocks non-members from seeing project details
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, user_id, name") // Added name here
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Project not found or invalid link." };
  }

  if (project.user_id === user.id) {
    return { error: "You are already the owner of this project." };
  }

  // Create Request
  const { error } = await supabase.from("access_requests").insert({
    project_id: projectId,
    user_id: user.id,
    status: "pending",
    requested_environment: requestedEnvironment || null,
  });
  // If conflict (unique constraint), just return success (idempotent for user)

  if (error) {
    if (error.code === "23505") {
      await supabase
        .from("access_requests")
        .update({
          requested_environment: requestedEnvironment || null,
          status: "pending",
        })
        .eq("project_id", projectId)
        .eq("user_id", user.id);
      return {
        success: true,
        message: requestedEnvironment
          ? `Request updated for ${formatEnvironmentLabel(requestedEnvironment)} environment and pending.`
          : "Request updated and pending.",
      };
    }
    return { error: error.message };
  }

  // Notify Owner via email and in-app notification
  try {
    // Get owner email
    const { data: owner } = await admin.auth.admin.getUserById(project.user_id);

    // Get requester email
    const { data: requester } = await admin.auth.admin.getUserById(user.id);

    if (owner?.user?.email && requester?.user?.email) {
      // We need to get the requestId.
      // If it was already pending, we might not have the ID from the insert.
      // But if it's new, we get it from data.
      const { data: requestData } = await supabase
        .from("access_requests")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .single();

      if (requestData) {
        // Send email notification
        const { sendAccessRequestEmail } = await import("@/lib/email");
        await sendAccessRequestEmail(
          owner.user.email,
          requester.user.email,
          project.name,
          requestData.id,
          requestedEnvironment,
          project.user_id, // Pass ownerId for preferences check
        );

        // Create in-app notification
        const { createAccessRequestNotification } =
          await import("@/lib/notifications");
        await createAccessRequestNotification(
          project.user_id,
          requester.user.email,
          project.name,
          projectId,
          user.id,
          requestData.id,
          requestedEnvironment,
        );
      }
    }
  } catch (emailError) {
    // Don't fail the request if email/notification fails
    console.error("Failed to send access request notification:", emailError);
  }

  return {
    success: true,
    message: requestedEnvironment
      ? `Access request sent for ${formatEnvironmentLabel(requestedEnvironment)} environment.`
      : "Access request sent.",
  };
}

export async function approveRequest(
  requestId: string,
  role: "viewer" | "editor",
  notifyUser: boolean = false,
  allowedEnvironments?: string[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Use Admin client for verification and modifications to bypass RLS issues during approval
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // Fetch request details
  const { data: request, error: requestError } = await admin
    .from("access_requests")
    .select("*, projects!inner(user_id, name, ui_mode)")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return { error: "Request not found." };
  }

  // Verify User is Owner of the Project
  const requestProject = request.projects as unknown as {
    user_id: string;
    name: string;
    ui_mode?: string | null;
  };
  const projectOwner = requestProject.user_id;
  if (projectOwner !== user.id) {
    return { error: "Unauthorized." };
  }

  const isAdvancedMode = requestProject.ui_mode === "advanced";

  const [{ data: requestedMemberProfile }, { data: requestedMemberAuth }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("username")
        .eq("id", request.user_id)
        .maybeSingle(),
      admin.auth.admin.getUserById(request.user_id),
    ]);
  const requestedMemberEmail = requestedMemberAuth?.user?.email || "";
  const requestedMemberName =
    requestedMemberProfile?.username ||
    (typeof requestedMemberAuth?.user?.user_metadata?.username === "string"
      ? requestedMemberAuth.user.user_metadata.username
      : undefined) ||
    (typeof requestedMemberAuth?.user?.user_metadata?.name === "string"
      ? requestedMemberAuth.user.user_metadata.name
      : undefined) ||
    requestedMemberEmail.split("@")[0] ||
    `user-${request.user_id.slice(0, 8)}`;

  // Check if user is already a member
  const { data: existingMember } = await admin
    .from("project_members")
    .select("id, role, allowed_environments")
    .eq("project_id", request.project_id!)
    .eq("user_id", request.user_id)
    .single();

  if (existingMember) {
    const roleRank = (r: string) => (r === "editor" ? 2 : 1);
    const existingRole = existingMember.role as "viewer" | "editor";
    const mergedRole: "viewer" | "editor" =
      roleRank(role) > roleRank(existingRole) ? role : existingRole;

    const existingAllowed = existingMember.allowed_environments as
      | string[]
      | null
      | undefined;
    const mergedAllowedEnvironments = !isAdvancedMode
      ? null
      : existingAllowed === null || existingAllowed === undefined
        ? null
        : allowedEnvironments
          ? Array.from(new Set([...existingAllowed, ...allowedEnvironments]))
          : existingAllowed;

    const { error: updateMemberError } = await admin
      .from("project_members")
      .update({
        role: mergedRole,
        allowed_environments: mergedAllowedEnvironments,
      })
      .eq("project_id", request.project_id!)
      .eq("user_id", request.user_id);

    if (updateMemberError) {
      return { error: updateMemberError.message };
    }

    const projectName = (request.projects as unknown as { name: string }).name;

    if (mergedRole !== existingRole) {
      await logAuditEvent({
        projectId: request.project_id!,
        actorId: user.id,
        actorType: "user",
        action: "member.role_updated",
        targetResourceId: request.user_id,
        metadata: {
          member_user_id: request.user_id,
          beneficiary_user_id: request.user_id,
          beneficiary_name: requestedMemberName,
          beneficiary_email: requestedMemberEmail,
          project_name: projectName,
          changes: {
            role: {
              old: existingRole,
              new: mergedRole,
            },
          },
        },
      });
    }

    const accessEvents = deriveAccessChangeEvents(
      existingAllowed,
      mergedAllowedEnvironments,
    );
    for (const accessEvent of accessEvents) {
      await logAuditEvent({
        projectId: request.project_id!,
        actorId: user.id,
        actorType: "user",
        action: accessEvent.action,
        targetResourceId: request.user_id,
        metadata: {
          member_user_id: request.user_id,
          beneficiary_user_id: request.user_id,
          beneficiary_name: requestedMemberName,
          beneficiary_email: requestedMemberEmail,
          project_name: projectName,
          changes: {
            allowed_environments: {
              old: accessEvent.old,
              new: accessEvent.new,
            },
          },
        },
      });
    }

    await admin.from("access_requests").delete().eq("id", requestId);

    await cacheDel(CacheKeys.userProjects(request.user_id));
    await cacheDel(
      CacheKeys.userProjectRole(request.user_id, request.project_id!),
    );
    await cacheDel(CacheKeys.projectMembers(request.project_id!));
    await invalidateUserSecretAccess(request.user_id);

    if (notifyUser) {
      try {
        const { data: requesterUser } = await admin.auth.admin.getUserById(
          request.user_id,
        );
        const projectName = (request.projects as unknown as { name: string })
          .name;

        if (requesterUser?.user?.email) {
          const { sendAccessUpdatedEmail } = await import("@/lib/email");
          await sendAccessUpdatedEmail(
            requesterUser.user.email,
            projectName,
            existingRole,
            mergedRole,
            "Project Owner",
            mergedAllowedEnvironments,
            request.user_id,
          );
        }

        const { createAccessGrantedNotification } =
          await import("@/lib/notifications");
        await createAccessGrantedNotification(
          request.user_id,
          projectName,
          request.project_id!,
          mergedRole,
          mergedAllowedEnvironments,
        );
      } catch (notifyError) {
        console.error(
          "Failed to notify existing member approval update:",
          notifyError,
        );
      }
    }

    return { success: true };
  }

  // 1. Add to Project Members (Use Admin for reliability)
  const insertData: Record<string, unknown> = {
    project_id: request.project_id!,
    user_id: request.user_id,
    role: role,
    added_by: user.id,
  };

  if (!isAdvancedMode) {
    insertData.allowed_environments = null;
  } else if (allowedEnvironments !== undefined) {
    insertData.allowed_environments = allowedEnvironments;
  }

  const { error: memberError } = await admin
    .from("project_members")
    .insert(insertData);

  if (memberError) {
    return { error: memberError.message };
  }

  const projectNameForAudit = requestProject.name;
  const normalizedAllowed = normalizeAllowedEnvironments(
    isAdvancedMode ? allowedEnvironments : null,
  );

  await logAuditEvent({
    projectId: request.project_id!,
    actorId: user.id,
    actorType: "user",
    action: "member.invited",
    targetResourceId: request.user_id,
    metadata: {
      member_user_id: request.user_id,
      beneficiary_user_id: request.user_id,
      beneficiary_name: requestedMemberName,
      beneficiary_email: requestedMemberEmail,
      role,
      project_name: projectNameForAudit,
    },
  });

  await logAuditEvent({
    projectId: request.project_id!,
    actorId: user.id,
    actorType: "user",
    action: "environment.access_granted",
    targetResourceId: request.user_id,
    metadata: {
      member_user_id: request.user_id,
      beneficiary_user_id: request.user_id,
      beneficiary_name: requestedMemberName,
      beneficiary_email: requestedMemberEmail,
      project_name: projectNameForAudit,
      changes: {
        allowed_environments: {
          old: [],
          new: normalizedAllowed === null ? "all" : normalizedAllowed,
        },
      },
    },
  });

  // 1.5. Clean up any existing secret_shares for this user in this project
  // Since they now have full project access, individual secret shares are redundant
  const { data: projectSecrets } = await admin
    .from("secrets")
    .select("id")
    .eq("project_id", request.project_id!);

  if (projectSecrets && projectSecrets.length > 0) {
    const secretIds = projectSecrets.map((s) => s.id);
    const { error: cleanupError } = await admin
      .from("secret_shares")
      .delete()
      .eq("user_id", request.user_id)
      .in("secret_id", secretIds);

    if (cleanupError) {
      // Don't fail the request for this, just log it
    }
  }

  // 2. Delete Request (Use Admin to ensure it's removed)
  const { error: deleteError } = await admin
    .from("access_requests")
    .delete()
    .eq("id", requestId);
  if (deleteError) {
    // Warning logged
  }

  // 3. Invalidate caches for the new member
  await cacheDel(CacheKeys.userProjects(request.user_id));
  await cacheDel(
    CacheKeys.userProjectRole(request.user_id, request.project_id!),
  );
  await cacheDel(CacheKeys.projectMembers(request.project_id!));

  // 4. Notify User via email and in-app notification
  if (notifyUser) {
    const { sendAccessGrantedEmail } = await import("@/lib/email");
    // We need requester email.
    // Supabase join `auth_users` might return it if we have access to auth schema (rarely enabled by default for users)
    // Usually we can't select from `auth.users` directly via client unless view exists.
    // We might need to use `supabaseAdmin` to fetch the email OR rely on the ID.

    // Use Admin client for email lookup
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSupabase = createAdminClient();
    const { data: requester } = await adminSupabase.auth.admin.getUserById(
      request.user_id,
    );

    if (requester && requester.user && requester.user.email) {
      const projectName = (request.projects as unknown as { name: string })
        .name;

      // Send email
      await sendAccessGrantedEmail(
        requester.user.email,
        projectName,
        role,
        allowedEnvironments ?? null,
        request.user_id,
      );

      // Create in-app notification
      const { createAccessGrantedNotification } =
        await import("@/lib/notifications");
      await createAccessGrantedNotification(
        request.user_id,
        projectName,
        request.project_id!,
        role,
        allowedEnvironments ?? null,
      );
    }
  }

  revalidatePath("/dashboard"); // Refresh owner dashboard
  revalidatePath("/project/[slug]", "page"); // Refresh project page
  return { success: true };
}

export async function rejectRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Use Admin client
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // Fetch request to verify ownership
  const { data: request, error: fetchError } = await admin
    .from("access_requests")
    .select("projects!inner(user_id, name)")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { error: "Request not found." };
  }

  const projectOwner = (request.projects as unknown as { user_id: string })
    .user_id;
  if (projectOwner !== user.id) {
    return { error: "Unauthorized." };
  }

  // Get project details and requester info for notification
  const { data: fullRequest } = await admin
    .from("access_requests")
    .select("user_id, project_id, projects(name)")
    .eq("id", requestId)
    .single();

  // Hard Delete
  const { error: deleteError } = await admin
    .from("access_requests")
    .delete()
    .eq("id", requestId);
  if (deleteError) {
    return { error: deleteError.message };
  }

  // Notify requester that their request was denied
  if (fullRequest) {
    try {
      const { createAccessDeniedNotification } =
        await import("@/lib/notifications");
      const { sendAccessDeniedEmail } = await import("@/lib/email");
      const projectName =
        (fullRequest.projects as unknown as { name: string })?.name ||
        "Unknown Project";
      await createAccessDeniedNotification(
        fullRequest.user_id,
        projectName,
        fullRequest.project_id,
      );
      const { data: requester } = await admin.auth.admin.getUserById(
        fullRequest.user_id,
      );
      if (requester?.user?.email) {
        await sendAccessDeniedEmail(
          requester.user.email,
          projectName,
          fullRequest.user_id,
        );
      }
    } catch (error) {
      console.error("Failed to send access denied notification:", error);
    }
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function removeMember(projectId: string, memberUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Verify Owner
  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, projectId, user.id);

  if (role !== "owner") return { error: "Unauthorized" };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const [{ data: projectData }, { data: removedUser }, { data: actorUser }] =
    await Promise.all([
      admin.from("projects").select("name").eq("id", projectId).single(),
      admin.auth.admin.getUserById(memberUserId),
      admin.auth.admin.getUserById(user.id),
    ]);
  const { data: removedUserProfile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", memberUserId)
    .maybeSingle();
  const { data: actorProfile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const projectName = projectData?.name || "Project";
  const removedBy =
    actorProfile?.username ||
    actorUser?.user?.user_metadata?.username ||
    "Owner";
  const removedUserEmail = removedUser?.user?.email || "";
  const removedUserName =
    removedUserProfile?.username ||
    (typeof removedUser?.user?.user_metadata?.username === "string"
      ? removedUser.user.user_metadata.username
      : undefined) ||
    (typeof removedUser?.user?.user_metadata?.name === "string"
      ? removedUser.user.user_metadata.name
      : undefined) ||
    removedUserEmail.split("@")[0] ||
    `user-${memberUserId.slice(0, 8)}`;

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", memberUserId);

  if (error) return { error: error.message };

  await logAuditEvent({
    projectId,
    actorId: user.id,
    actorType: "user",
    action: "member.removed",
    targetResourceId: memberUserId,
    metadata: {
      member_user_id: memberUserId,
      beneficiary_user_id: memberUserId,
      beneficiary_name: removedUserName,
      beneficiary_email: removedUserEmail,
      project_name: projectName,
    },
  });

  await logAuditEvent({
    projectId,
    actorId: user.id,
    actorType: "user",
    action: "environment.access_revoked",
    targetResourceId: memberUserId,
    metadata: {
      member_user_id: memberUserId,
      beneficiary_user_id: memberUserId,
      beneficiary_name: removedUserName,
      beneficiary_email: removedUserEmail,
      project_name: projectName,
      changes: {
        allowed_environments: {
          old: "all",
          new: [],
        },
      },
    },
  });

  // Invalidate caches for the removed member
  await cacheDel(CacheKeys.userProjects(memberUserId));
  await cacheDel(CacheKeys.userProjectRole(memberUserId, projectId));
  await cacheDel(CacheKeys.projectMembers(projectId));
  // Invalidate all secret access caches for this user in this project
  await invalidateUserSecretAccess(memberUserId);

  try {
    const { createMemberRemovedNotification } =
      await import("@/lib/notifications");
    const { sendAccessRevokedEmail } = await import("@/lib/email");

    await createMemberRemovedNotification(memberUserId, projectName, removedBy);
    if (removedUser?.user?.email) {
      await sendAccessRevokedEmail(
        removedUser.user.email,
        projectName,
        removedBy,
        memberUserId,
      );
    }
  } catch (notifyError) {
    console.error("Failed to notify removed member:", notifyError);
  }

  revalidatePath("/project/[slug]", "page");
  return { success: true };
}

export async function updateMemberRole(
  projectId: string,
  memberUserId: string,
  newRole: "viewer" | "editor",
  allowedEnvironments?: string[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Verify Owner
  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, projectId, user.id);

  if (role !== "owner") return { error: "Unauthorized" };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const [
    { data: existingMember },
    { data: projectData },
    { data: actorUser },
    { data: memberUser },
    { data: memberProfile },
  ] = await Promise.all([
    admin
      .from("project_members")
      .select("role, allowed_environments")
      .eq("project_id", projectId)
      .eq("user_id", memberUserId)
      .single(),
    admin.from("projects").select("name, slug").eq("id", projectId).single(),
    admin.auth.admin.getUserById(user.id),
    admin.auth.admin.getUserById(memberUserId),
    admin
      .from("profiles")
      .select("username")
      .eq("id", memberUserId)
      .maybeSingle(),
  ]);
  const { data: actorProfile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingMember) {
    return { error: "Member not found." };
  }

  const previousRole = existingMember.role as "viewer" | "editor";
  const previousAllowed = existingMember.allowed_environments as
    | string[]
    | null
    | undefined;
  const memberEmail = memberUser?.user?.email || "";
  const memberName =
    memberProfile?.username ||
    (typeof memberUser?.user?.user_metadata?.username === "string"
      ? memberUser.user.user_metadata.username
      : undefined) ||
    (typeof memberUser?.user?.user_metadata?.name === "string"
      ? memberUser.user.user_metadata.name
      : undefined) ||
    memberEmail.split("@")[0] ||
    `user-${memberUserId.slice(0, 8)}`;

  const updateData: Record<string, unknown> = { role: newRole };

  if (allowedEnvironments !== undefined) {
    updateData.allowed_environments = allowedEnvironments;
  }

  console.log("updateMemberRole: Attempting to update", {
    projectId,
    memberUserId,
    updateData,
  });

  const { data, error } = await supabase
    .from("project_members")
    .update(updateData)
    .eq("project_id", projectId)
    .eq("user_id", memberUserId)
    .select();

  console.log("updateMemberRole: Supabase response", { data, error });

  if (error) {
    console.error("updateMemberRole error:", error);
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    console.error(
      "updateMemberRole: No rows updated. Possibly an RLS issue or mismatched IDs.",
    );
    return {
      error:
        "No rows were updated. Check permissions or if the user exists in the project.",
    };
  }

  const nextAllowed = allowedEnvironments ?? previousAllowed ?? null;

  if (previousRole !== newRole) {
    await logAuditEvent({
      projectId,
      actorId: user.id,
      actorType: "user",
      action: "member.role_updated",
      targetResourceId: memberUserId,
      metadata: {
        member_user_id: memberUserId,
        beneficiary_user_id: memberUserId,
        beneficiary_name: memberName,
        beneficiary_email: memberEmail,
        project_name: projectData?.name || "Project",
        changes: {
          role: {
            old: previousRole,
            new: newRole,
          },
        },
      },
    });
  }

  const accessEvents = deriveAccessChangeEvents(previousAllowed, nextAllowed);
  for (const accessEvent of accessEvents) {
    await logAuditEvent({
      projectId,
      actorId: user.id,
      actorType: "user",
      action: accessEvent.action,
      targetResourceId: memberUserId,
      metadata: {
        member_user_id: memberUserId,
        beneficiary_user_id: memberUserId,
        beneficiary_name: memberName,
        beneficiary_email: memberEmail,
        project_name: projectData?.name || "Project",
        changes: {
          allowed_environments: {
            old: accessEvent.old,
            new: accessEvent.new,
          },
        },
      },
    });
  }

  // Invalidate caches for the member whose role changed
  await cacheDel(CacheKeys.userProjectRole(memberUserId, projectId));
  // Invalidate all secret access caches since permissions changed
  await invalidateUserSecretAccess(memberUserId);

  try {
    const { createRoleChangedNotification } =
      await import("@/lib/notifications");
    const { sendAccessUpdatedEmail } = await import("@/lib/email");
    const projectName = projectData?.name || "Project";
    const projectSlug = projectData?.slug || projectId;
    const changedBy =
      actorProfile?.username ||
      actorUser?.user?.user_metadata?.username ||
      "Owner";

    await createRoleChangedNotification(
      memberUserId,
      projectName,
      projectId,
      previousRole,
      newRole,
      changedBy,
      projectSlug,
      previousAllowed ?? null,
      allowedEnvironments ?? previousAllowed ?? null,
    );

    if (memberUser?.user?.email) {
      await sendAccessUpdatedEmail(
        memberUser.user.email,
        projectName,
        previousRole,
        newRole,
        changedBy,
        allowedEnvironments ?? previousAllowed ?? null,
        memberUserId,
      );
    }
  } catch (notifyError) {
    console.error(
      "Failed to send role/environment update notifications:",
      notifyError,
    );
  }

  revalidatePath("/project/[slug]", "page");
  return { success: true };
}

export async function inviteUser(projectId: string, email: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Verify Owner or Editor
  const { getProjectRole } = await import("@/lib/permissions");
  const role = await getProjectRole(supabase, projectId, user.id);

  if (role !== "owner" && role !== "editor") return { error: "Unauthorized" };

  // Check project name for email
  const { data: project } = await supabase
    .from("projects")
    .select("name, user_id")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Project not found" };

  // Check if the email belongs to a user who is already a member
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: users } = await admin.auth.admin.listUsers();
  const invitedUser = users.users.find((u) => u.email === email);

  if (invitedUser) {
    // Check if it's the project owner
    if (invitedUser.id === project.user_id) {
      return { error: "Cannot invite the project owner." };
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", invitedUser.id)
      .single();

    if (existingMember) {
      return { error: "User is already a member of this project." };
    }
  }

  // Send Email
  const { sendInviteEmail } = await import("@/lib/email");
  await sendInviteEmail(email, project.name, projectId);

  await logAuditEvent({
    projectId,
    actorId: user.id,
    actorType: "user",
    action: "member.invited",
    targetResourceId: invitedUser?.id || null,
    metadata: {
      beneficiary_user_id: invitedUser?.id,
      beneficiary_email: email,
      invited_email: email,
      project_name: project.name,
    },
  });

  return { success: true };
}

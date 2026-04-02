"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import {
  CreateComponentSchema,
  CreateIncidentSchema,
  UpdateComponentStatusSchema,
  UpdateIncidentSchema,
  ComponentStatusEnum,
  IncidentSeverityEnum,
  IncidentStatusEnum,
} from "@/lib/types/schemas";
import { z } from "zod";

// Define types locally to avoid re-export issues with type-only strings in Server Actions
export type ComponentStatus = z.infer<typeof ComponentStatusEnum>;
export type IncidentSeverity = z.infer<typeof IncidentSeverityEnum>;
export type IncidentStatus = z.infer<typeof IncidentStatusEnum>;

export interface Component {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  group_name: string | null;
  status: ComponentStatus;
  updated_at: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  incident_updates: IncidentUpdate[];
  components: Component[];
}

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  message: string;
  status: IncidentStatus;
  created_at: string;
}

async function checkAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  // Only check app_metadata to match RLS policies (user_metadata is insecure)
  const isAdmin = user.app_metadata?.is_admin === true;
  if (!isAdmin) {
    throw new Error("Unauthorized: Admin access required");
  }
  return supabase;
}

export async function getComponents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("status_components")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data as Component[];
}

export async function updateComponentStatus(
  id: string,
  status: ComponentStatus,
) {
  const validation = UpdateComponentStatusSchema.safeParse({ id, status });
  if (!validation.success) {
    throw new Error(
      `Validation failed: ${validation.error.issues.map((i) => i.message).join(", ")}`,
    );
  }

  const supabase = await checkAdmin();

  const { error } = await supabase
    .from("status_components")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/status");
  revalidatePath("/admin/status");
  return { success: true };
}

export async function getIncidents(limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("status_incidents")
    .select(
      `
      *,
      incident_updates:status_incident_updates(*),
      components:status_components!status_component_incidents(*)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  // Sort incident_updates by created_at DESC on the client side
  const sortedData = data?.map((incident) => ({
    ...incident,
    incident_updates:
      incident.incident_updates?.sort(
        (a: IncidentUpdate, b: IncidentUpdate) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ) || [],
  }));

  return sortedData;
}

export async function createIncident(
  title: string,
  severity: IncidentSeverity,
  status: IncidentStatus,
  componentIds: string[],
  initialMessage: string,
) {
  const validation = CreateIncidentSchema.safeParse({
    title,
    severity,
    status,
    componentIds,
    initialMessage,
  });

  if (!validation.success) {
    throw new Error(
      `Validation failed: ${validation.error.issues.map((i) => i.message).join(", ")}`,
    );
  }

  const supabase = await checkAdmin();

  // 1. Create Incident
  const { data: incident, error: incidentError } = await supabase
    .from("status_incidents")
    .insert({ title, severity, status })
    .select()
    .single();

  if (incidentError) throw new Error(incidentError.message);

  const incidentId = incident.id;

  // 2. Link Components
  if (componentIds.length > 0) {
    const links = componentIds.map((id) => ({
      incident_id: incidentId,
      component_id: id,
    }));

    const { error: linkError } = await supabase
      .from("status_component_incidents")
      .insert(links);

    if (linkError) throw new Error(linkError.message);
  }

  // 3. Create Initial Update
  const { error: updateError } = await supabase
    .from("status_incident_updates")
    .insert({
      incident_id: incidentId,
      message: initialMessage,
      status: status,
    });

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/status");
  revalidatePath("/admin/status");

  // Notify all users (app notification + email) respecting their preferences
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    // Fetch all auth users
    const { data: usersData } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    const users = usersData?.users ?? [];

    const notificationTitle = `New Incident: ${title}`;
    const notificationMessage = `${severity.charAt(0).toUpperCase() + severity.slice(1)} severity - ${initialMessage}`;

    const { createNotification } = await import("@/lib/system/notifications");
    const { sendSystemUpdateEmail } = await import("@/lib/infra/email");

    await Promise.allSettled(
      users.map(async (user) => {
        // App notification
        await createNotification({
          userId: user.id,
          type: "incident_created",
          title: notificationTitle,
          message: notificationMessage,
          variant:
            severity === "critical"
              ? "error"
              : severity === "major"
                ? "warning"
                : "info",
          metadata: { incidentId, severity, status },
          actionUrl: "/status",
          actionType: "view_status",
        });

        // Email notification (sendSystemUpdateEmail checks email_system_updates preference)
        if (user.email) {
          await sendSystemUpdateEmail(
            user.email,
            notificationTitle,
            notificationMessage,
            user.id,
          );
        }
      }),
    );
  } catch (notifError) {
    // Don't fail incident creation if notifications fail
    console.error("Failed to send incident notifications:", notifError);
  }

  return { success: true, incidentId };
}

export async function updateIncident(
  incidentId: string,
  status: IncidentStatus,
  message: string,
) {
  const validation = UpdateIncidentSchema.safeParse({
    incidentId,
    status,
    message,
  });
  if (!validation.success) {
    throw new Error(
      `Validation failed: ${validation.error.issues.map((i) => i.message).join(", ")}`,
    );
  }

  const supabase = await checkAdmin();

  // 1. Update Incident Status
  const { error: incidentError } = await supabase
    .from("status_incidents")
    .update({ status })
    .eq("id", incidentId);

  if (incidentError) throw new Error(incidentError.message);

  // 2. Add Update Record
  const { error: updateError } = await supabase
    .from("status_incident_updates")
    .insert({
      incident_id: incidentId,
      message: message,
      status: status,
    });

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/status");
  revalidatePath("/admin/status");
  return { success: true };
}

export async function createComponent(name: string, description: string) {
  const validation = CreateComponentSchema.safeParse({ name, description });
  if (!validation.success) {
    throw new Error(
      `Validation failed: ${validation.error.issues.map((i) => i.message).join(", ")}`,
    );
  }

  const supabase = await checkAdmin();

  const { data, error } = await supabase
    .from("status_components")
    .insert({
      name,
      description,
      status: "operational",
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/status");
  revalidatePath("/admin/status");
  return { success: true, component: data };
}

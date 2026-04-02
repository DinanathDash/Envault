/**
 * Decoupled system-status helper.
 *
 * Data flow:
 *   1. Read from Upstash Redis (TTL 60 s) - fast, independent of primary DB.
 *   2. On cache miss -> query Supabase, compute summary, write back to Redis.
 *   3. If both fail -> return "operational" (fail-open, never breaks the app).
 */

import { getRedisClient } from "@/lib/infra/redis";
import { createClient } from "@/lib/supabase/server";
import type { StatusLevel } from "@/lib/system/status-config";

// Re-export so consumers can import from one place
export type { StatusLevel } from "@/lib/system/status-config";

export interface SystemStatusSummary {
  level: StatusLevel;
  message: string | null;
  /** Number of currently active (non-resolved) incidents */
  incidentCount: number;
}

const CACHE_KEY = "system:status:summary";
const CACHE_TTL_SECONDS = 60;

/** Map Supabase component statuses -> banner severity levels */
function componentToLevel(status: string): StatusLevel {
  switch (status) {
    case "outage":
      return "outage";
    case "degraded":
      return "degraded";
    case "maintenance":
      return "maintenance";
    default:
      return "operational";
  }
}

/** Map active incident severity -> banner severity levels */
function incidentToLevel(severity: string): StatusLevel {
  switch (severity) {
    case "critical":
      return "outage";
    case "major":
      return "degraded";
    case "minor":
    case "maintenance":
      return "maintenance";
    default:
      return "degraded";
  }
}

/** Combine multiple levels and return the worst one */
function worstLevel(levels: StatusLevel[]): StatusLevel {
  const order: StatusLevel[] = [
    "operational",
    "maintenance",
    "degraded",
    "outage",
  ];
  return levels.reduce<StatusLevel>((worst, current) => {
    return order.indexOf(current) > order.indexOf(worst) ? current : worst;
  }, "operational");
}

async function computeStatusFromDB(): Promise<SystemStatusSummary> {
  const supabase = await createClient();

  const [{ data: components }, { data: incidents }] = await Promise.all([
    supabase
      .from("status_components")
      .select("name, status")
      .neq("status", "operational"),
    supabase
      .from("status_incidents")
      .select("title, severity, status")
      .neq("status", "resolved"),
  ]);

  const levels: StatusLevel[] = [];
  const messages: string[] = [];

  if (components?.length) {
    for (const c of components) {
      levels.push(componentToLevel(c.status));
    }
    const affectedNames = components
      .map((c: { name: string }) => c.name)
      .join(", ");
    messages.push(`Affected: ${affectedNames}`);
  }

  if (incidents?.length) {
    for (const i of incidents) {
      levels.push(incidentToLevel(i.severity));
    }
    // Show the most recent active incident title as the message
    messages.unshift(incidents[0].title);
  }

  const incidentCount = incidents?.length ?? 0;

  if (levels.length === 0) {
    return { level: "operational", message: null, incidentCount };
  }

  return {
    level: worstLevel(levels),
    message: messages[0] ?? null,
    incidentCount,
  };
}

export async function getSystemStatus(): Promise<SystemStatusSummary> {
  // 1. Try Redis cache first
  try {
    const redis = getRedisClient();
    const cached = await redis.get<SystemStatusSummary>(CACHE_KEY);
    if (cached) return cached;
  } catch {
    // Redis unavailable - fall through to DB
  }

  // 2. Compute from DB
  let summary: SystemStatusSummary;
  try {
    summary = await computeStatusFromDB();
  } catch {
    // DB also failed - fail open
    return { level: "operational", message: null, incidentCount: 0 };
  }

  // 3. Write back to Redis (best-effort)
  try {
    const redis = getRedisClient();
    await redis.set(CACHE_KEY, summary, { ex: CACHE_TTL_SECONDS });
  } catch {
    // Ignore write failure
  }

  return summary;
}

/** Call this from the admin panel or a webhook to bust the cache immediately */
export async function invalidateStatusCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(CACHE_KEY);
  } catch {
    // Ignore
  }
}

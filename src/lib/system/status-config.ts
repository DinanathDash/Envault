/**
 * Single source of truth for all status-level visual config.
 * Used by: status/page.tsx, system-status-banner.tsx, and any future status UI.
 *
 * NOTE: This is a plain .ts file (no JSX). Consumers receive the Lucide icon
 * component reference and render it themselves with their own className.
 */

import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  Search,
  Target,
  Eye,
  type LucideIcon,
} from "lucide-react";

export type StatusLevel = "operational" | "degraded" | "outage" | "maintenance";

export interface StatusLevelConfig {
  /** Lucide icon component - render as <cfg.icon className="..." /> */
  icon: LucideIcon;
  /** Tailwind text color class - e.g. "text-red-500" */
  color: string;
  /** Combined bg + border classes (space-separated) - matches the status page pill style */
  bgBorder: string;
  /** Background only - e.g. "bg-red-500/10" */
  bg: string;
  /** Border only - e.g. "border-red-500/20" */
  border: string;
  /** Hover border - e.g. "hover:border-red-500/50" */
  hoverBorder: string;
  /** Dot color - e.g. "bg-red-500" for small dot indicators */
  dot: string;
  /** Ring color - e.g. "ring-red-500/20" for ring-offset dot indicators */
  ring: string;
  /** Short human-readable label - e.g. "Major System Outage" */
  label: string;
  /** Default prose description shown under the label */
  message: string;
}

/** Maps incident severity -> the closest StatusLevel for visual consistency */
export const INCIDENT_SEVERITY_LEVEL: Record<
  "minor" | "major" | "critical" | "maintenance",
  StatusLevel
> = {
  minor: "maintenance",
  major: "degraded",
  critical: "outage",
  maintenance: "maintenance",
};

export const STATUS_CONFIG: Record<StatusLevel, StatusLevelConfig> = {
  operational: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bgBorder: "bg-emerald-500/10 border-emerald-500/20",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/50",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/20",
    label: "All Systems Operational",
    message: "All services are running smoothly.",
  },
  degraded: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bgBorder: "bg-amber-500/10 border-amber-500/20",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    hoverBorder: "hover:border-amber-500/50",
    dot: "bg-amber-500",
    ring: "ring-amber-500/20",
    label: "Partial System Outage",
    message: "Some systems are experiencing issues.",
  },
  outage: {
    icon: XCircle,
    color: "text-red-500",
    bgBorder: "bg-red-500/10 border-red-500/20",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    hoverBorder: "hover:border-red-500/50",
    dot: "bg-red-500",
    ring: "ring-red-500/20",
    label: "Major System Outage",
    message:
      "We are currently experiencing a major outage. Our team is investigating.",
  },
  maintenance: {
    icon: Wrench,
    color: "text-blue-500",
    bgBorder: "bg-blue-500/10 border-blue-500/20",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    hoverBorder: "hover:border-blue-500/50",
    dot: "bg-blue-500",
    ring: "ring-blue-500/20",
    label: "System Maintenance",
    message: "Scheduled maintenance is currently in progress.",
  },
};

// ---------------------------------------------------------------------------
// Incident phase (status) config
// ---------------------------------------------------------------------------

export type IncidentPhase =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

export interface IncidentPhaseConfig {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Tailwind text color */
  color: string;
  /** Tailwind bg color for dot indicators */
  dot: string;
  /** Human-readable label */
  label: string;
}

/**
 * Visual config for each incident lifecycle phase.
 * Used in the public status page timeline and admin incident cards.
 *
 * investigating -> red   (urgently looking for root cause)
 * identified    -> amber (found it, working on a fix)
 * monitoring    -> blue  (fix deployed, watching for stabilisation)
 * resolved      -> emerald (fully resolved)
 */
export const INCIDENT_PHASE_CONFIG: Record<IncidentPhase, IncidentPhaseConfig> =
  {
    investigating: {
      icon: Search,
      color: "text-red-500",
      dot: "bg-red-500",
      label: "Investigating",
    },
    identified: {
      icon: Target,
      color: "text-amber-500",
      dot: "bg-amber-500",
      label: "Identified",
    },
    monitoring: {
      icon: Eye,
      color: "text-blue-500",
      dot: "bg-blue-500",
      label: "Monitoring",
    },
    resolved: {
      icon: CheckCircle2,
      color: "text-emerald-500",
      dot: "bg-emerald-500",
      label: "Resolved",
    },
  };

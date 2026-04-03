"use client";

import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { AuditLogsSkeleton } from "@/components/dashboard/audit-logs-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Eye,
  Github,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  ArrowRightLeft,
  UserCog,
  UserMinus,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DateDisplay } from "@/components/ui/date-display";

interface AuditLogChange {
  old: unknown;
  new: unknown;
}

interface AuditLogMetadata {
  changes?: Record<string, AuditLogChange>;
  key_name?: string;
  invited_email?: string;
  environment?: string;
  source?: string;
  count?: number;
  role?: string;
  member_user_id?: string;
  target_user_id?: string;
  target_name?: string;
  target_email?: string;
  previous_owner_id?: string;
  previous_owner_name?: string;
  previous_owner_email?: string;
  new_owner_id?: string;
  new_owner_name?: string;
  new_owner_email?: string;
  rejected_by_user_id?: string;
  rejected_by_name?: string;
  rejected_by_email?: string;
  current_owner_action?: "demote_to_editor" | "remove_from_project";
  previous_owner_disposition?: "demote_to_editor" | "remove_from_project";
  granted_role?: string;
  granted_access?: string;
  requested_role?: string;
  transferred_secret_count?: number;
  beneficiary_user_id?: string;
  beneficiary_name?: string;
  beneficiary_email?: string;
  repo_full_name?: string;
  reason?: string;
  installation_id?: number;
  account_login?: string;
  account_type?: string;
  approval_id?: string;
  result?: string;
  mutation_count?: number;
  keys?: string[];
  agent_id?: string;
  agent_label?: string;
}

function getFriendlyAgentLabel(metadata?: AuditLogMetadata): string {
  const explicitLabel = firstNonEmpty(metadata?.agent_label);
  if (explicitLabel) return explicitLabel;

  const rawId = firstNonEmpty(metadata?.agent_id);
  if (!rawId) return "Envault Agent";

  // Hide internal/testing identifiers from user-facing audit summaries.
  if (/headless|e2e|test/i.test(rawId)) {
    return "Envault Agent";
  }

  return rawId;
}

interface AuditLog {
  id: string;
  created_at: string;
  actor_id: string;
  actor_type: "user" | "machine";
  action: string;
  actor_email?: string;
  actor_name?: string;
  actor_avatar?: string;
  metadata?: AuditLogMetadata;
}

interface DetailRow {
  label: string;
  value: string;
}

interface ProjectMemberOption {
  user_id: string;
  email?: string;
  username?: string;
  avatar?: string;
}

interface AuditLogsViewProps {
  projectId: string;
}

const ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "secret.created", label: "Secret Created" },
  { value: "secret.updated", label: "Secret Updated" },
  { value: "secret.deleted", label: "Secret Deleted" },
  { value: "secret.read_batch", label: "Secret Read Batch" },
  { value: "member.invited", label: "Member Invited" },
  { value: "member.role_updated", label: "Member Role Updated" },
  { value: "member.removed", label: "Member Removed" },
  { value: "transfer.requested", label: "Ownership Transfer Requested" },
  { value: "transfer.accepted", label: "Ownership Transfer Accepted" },
  { value: "transfer.rejected", label: "Ownership Transfer Rejected" },
  { value: "environment.access_updated", label: "Environment Access Updated" },
  { value: "environment.access_granted", label: "Environment Access Granted" },
  { value: "environment.access_revoked", label: "Environment Access Revoked" },
  { value: "github.account_connected", label: "GitHub Account Connected" },
  {
    value: "github.account_disconnected",
    label: "GitHub Account Disconnected",
  },
  { value: "github.repo_linked", label: "GitHub Repo Linked" },
  { value: "github.repo_unlinked", label: "GitHub Repo Unlinked" },
  { value: "AGENT_APPROVED_CHANGE", label: "Agent Approved Change" },
  { value: "AGENT_REJECTED_CHANGE", label: "Agent Rejected Change" },
];

function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : value.join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }
  return String(value);
}

function formatFieldLabel(field: string, keyName?: string): string {
  if (field === "value" && keyName) {
    return `Secret Value (${keyName})`;
  }

  return field
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getBeneficiaryLabel(metadata?: AuditLogMetadata): string | null {
  if (!metadata) return null;
  return (
    metadata.beneficiary_name ||
    metadata.beneficiary_email ||
    metadata.invited_email ||
    metadata.member_user_id ||
    metadata.beneficiary_user_id ||
    null
  );
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function getTransferDispositionLabel(
  value: AuditLogMetadata["previous_owner_disposition"],
): string {
  if (value === "demote_to_editor") return "Demoted to Editor";
  if (value === "remove_from_project") return "Removed from Project";
  return "";
}

function getGrantedAccessLabel(metadata: AuditLogMetadata): string {
  const raw = firstNonEmpty(metadata.granted_access, metadata.granted_role);
  if (!raw) return "";
  if (raw.toLowerCase().includes("owner")) return "Owner";
  return raw
    .replace(/[_\.]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRequestedAccessLabel(metadata: AuditLogMetadata): string {
  const raw = firstNonEmpty(metadata.requested_role);
  if (!raw) return "";
  if (raw.toLowerCase().includes("owner")) return "Owner";
  return raw
    .replace(/[_\.]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getTransferDetailRows(
  action: string,
  metadata: AuditLogMetadata | undefined,
): DetailRow[] {
  if (!metadata || !action.startsWith("transfer.")) {
    return [];
  }

  const rows: DetailRow[] = [];
  const previousOwner = firstNonEmpty(
    metadata.previous_owner_name,
    metadata.previous_owner_email,
    metadata.previous_owner_id,
  );
  const targetUser = firstNonEmpty(
    metadata.target_name,
    metadata.target_email,
    metadata.target_user_id,
  );
  const newOwner = firstNonEmpty(
    metadata.new_owner_name,
    metadata.new_owner_email,
    metadata.new_owner_id,
    metadata.beneficiary_name,
    metadata.beneficiary_email,
    metadata.beneficiary_user_id,
  );
  const rejectedBy = firstNonEmpty(
    metadata.rejected_by_name,
    metadata.rejected_by_email,
    metadata.rejected_by_user_id,
  );
  const granted = getGrantedAccessLabel(metadata);
  const requested = getRequestedAccessLabel(metadata);
  const disposition = getTransferDispositionLabel(
    metadata.previous_owner_disposition || metadata.current_owner_action,
  );
  const transferredCount =
    typeof metadata.transferred_secret_count === "number"
      ? metadata.transferred_secret_count
      : null;

  if (action === "transfer.requested") {
    if (previousOwner)
      rows.push({ label: "Current Owner", value: previousOwner });
    if (targetUser || newOwner) {
      rows.push({ label: "Target User", value: targetUser || newOwner });
    }
    if (granted) rows.push({ label: "Requested Access", value: granted });
    if (disposition) rows.push({ label: "On Acceptance", value: disposition });
    return rows;
  }

  if (action === "transfer.accepted") {
    if (previousOwner)
      rows.push({ label: "Previous Owner", value: previousOwner });
    if (newOwner || targetUser) {
      rows.push({ label: "New Owner", value: newOwner || targetUser });
    }
    if (granted) rows.push({ label: "Granted Access", value: granted });
    if (disposition)
      rows.push({ label: "Previous Owner Access", value: disposition });
    if (transferredCount !== null) {
      rows.push({
        label: "Secrets Reassigned",
        value: String(transferredCount),
      });
    }
    return rows;
  }

  if (action === "transfer.rejected") {
    if (previousOwner)
      rows.push({ label: "Current Owner", value: previousOwner });
    if (rejectedBy || targetUser || newOwner) {
      rows.push({
        label: "Rejected By",
        value: rejectedBy || targetUser || newOwner,
      });
    }
    if (requested) rows.push({ label: "Requested Access", value: requested });
    return rows;
  }

  return rows;
}

function getActionIcon(action: string) {
  if (action === "secret.created") return <KeyRound className="h-3.5 w-3.5" />;
  if (action === "secret.updated")
    return <ShieldCheck className="h-3.5 w-3.5" />;
  if (action === "secret.deleted") return <Trash2 className="h-3.5 w-3.5" />;
  if (action === "secret.read_batch") return <Eye className="h-3.5 w-3.5" />;
  if (action === "member.invited") return <UserPlus className="h-3.5 w-3.5" />;
  if (action === "member.role_updated")
    return <UserCog className="h-3.5 w-3.5" />;
  if (action === "member.removed") return <UserMinus className="h-3.5 w-3.5" />;
  if (action.startsWith("transfer."))
    return <ArrowRightLeft className="h-3.5 w-3.5" />;
  if (action === "environment.access_updated")
    return <RefreshCw className="h-3.5 w-3.5" />;
  if (action === "environment.access_granted")
    return <ShieldCheck className="h-3.5 w-3.5" />;
  if (action === "environment.access_revoked")
    return <ShieldOff className="h-3.5 w-3.5" />;
  if (action.startsWith("github.")) return <Github className="h-3.5 w-3.5" />;
  if (action === "AGENT_APPROVED_CHANGE")
    return <ShieldCheck className="h-3.5 w-3.5" />;
  if (action === "AGENT_REJECTED_CHANGE")
    return <ShieldOff className="h-3.5 w-3.5" />;
  return <AlertCircle className="h-3.5 w-3.5" />;
}

function getActionLabel(action: string): string {
  const option = ACTION_OPTIONS.find((item) => item.value === action);
  return option?.label ?? action;
}

function isRedactedPair(oldValue: unknown, newValue: unknown): boolean {
  return oldValue === "[REDACTED]" && newValue === "[REDACTED]";
}

function normalizeEnvValue(value: unknown): string[] | "all" | null {
  if (value === "all") return "all";
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return null;
}

type EnvAccessState = "none" | "some" | "all" | "unknown";

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

function getEnvironmentActionVariant(
  log: AuditLog,
):
  | "environment.access_granted"
  | "environment.access_revoked"
  | "environment.access_updated"
  | null {
  if (
    log.action !== "environment.access_granted" &&
    log.action !== "environment.access_revoked"
  ) {
    return null;
  }

  const envChange = log.metadata?.changes?.allowed_environments;
  if (!envChange) return log.action;

  const oldState = getEnvAccessState(envChange.old);
  const newState = getEnvAccessState(envChange.new);

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

  return log.action;
}

function getEffectiveAction(log: AuditLog): string {
  return getEnvironmentActionVariant(log) || log.action;
}

function isMemberRelatedAction(action: string): boolean {
  return (
    action.startsWith("member.") || action.startsWith("environment.access_")
  );
}

function getActionBadgeClass(action: string): string {
  if (action === "AGENT_APPROVED_CHANGE") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (action === "AGENT_REJECTED_CHANGE") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  if (action === "transfer.requested") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (action === "transfer.accepted") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (action === "transfer.rejected") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  if (action === "github.account_connected" || action === "github.repo_linked") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (
    action === "github.account_disconnected" ||
    action === "github.repo_unlinked"
  ) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  if (
    action.includes("deleted") ||
    action.includes("removed") ||
    action.includes("revoked")
  ) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  if (
    action.includes("updated") ||
    action.includes("read_batch") ||
    action.includes("role_updated")
  ) {
    return "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
  if (
    action.includes("created") ||
    action.includes("invited") ||
    action.includes("granted")
  ) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  return "border-muted-foreground/20 bg-muted text-muted-foreground";
}

function getDetailSummary(
  changeEntries: Array<[string, AuditLogChange]>,
  keyName?: string,
): string | null {
  const allowedEnvsChange = changeEntries.find(
    ([field]) => field === "allowed_environments",
  );
  if (allowedEnvsChange) {
    return `Allowed Environments: ${formatDiffValue(allowedEnvsChange[1].old)} to ${formatDiffValue(allowedEnvsChange[1].new)}`;
  }

  const roleChange = changeEntries.find(([field]) => field === "role");
  if (roleChange) {
    return `Role: ${formatDiffValue(roleChange[1].old)} to ${formatDiffValue(roleChange[1].new)}`;
  }

  const valueChange = changeEntries.find(([field]) => field === "value");
  if (valueChange && isRedactedPair(valueChange[1].old, valueChange[1].new)) {
    return keyName
      ? `Secret Value (${keyName}): updated securely`
      : "Secret value updated securely";
  }

  const keyNameChange = changeEntries.find(([field]) => field === "key_name");
  if (keyNameChange) {
    return `Secret Key: ${formatDiffValue(keyNameChange[1].old)} to ${formatDiffValue(keyNameChange[1].new)}`;
  }

  if (changeEntries.length > 0) {
    return `${changeEntries.length} field(s) changed`;
  }

  return null;
}

function getNonDiffContextSummary(
  action: string,
  metadata: AuditLogMetadata | undefined,
  keyName?: string,
): string | null {
  const count =
    typeof metadata?.count === "number" && Number.isFinite(metadata.count)
      ? metadata.count
      : null;
  const environment = metadata?.environment
    ? String(metadata.environment)
    : null;
  const source =
    metadata?.source === "cli"
      ? "CLI"
      : metadata?.source === "web_ui_download"
        ? "Web UI"
        : null;
  const envPart = environment ? ` in ${environment}` : "";
  const sourcePart = source ? ` via ${source}` : "";

  if (action === "member.invited" && metadata?.invited_email) {
    return `Invitation sent to ${metadata.invited_email}`;
  }

  if (action === "secret.created") {
    if (keyName) return `Created secret key: ${keyName}`;
    if (count !== null)
      return `Created ${count} secret(s)${envPart}${sourcePart}`;
    return `Secret created${envPart}${sourcePart}`;
  }

  if (action === "secret.updated") {
    if (keyName) return `Updated secret key: ${keyName}`;
    if (count !== null)
      return `Updated ${count} secret(s)${envPart}${sourcePart}`;
    return `Secret updated${envPart}${sourcePart}`;
  }

  if (action === "secret.deleted") {
    if (keyName) return `Deleted secret key: ${keyName}`;
    return "Secret deleted";
  }

  if (action === "secret.read_batch") {
    if (count !== null) return `Read ${count} secret(s)${envPart}${sourcePart}`;
    return `Batch secret read${envPart}${sourcePart}`;
  }

  if (action === "member.role_updated") {
    return "Member role updated";
  }

  if (action === "member.removed") {
    return "Member removed from project";
  }

  if (action === "transfer.requested") {
    const target = firstNonEmpty(
      metadata?.target_name,
      metadata?.target_email,
      metadata?.beneficiary_name,
      metadata?.beneficiary_email,
      metadata?.target_user_id,
      metadata?.beneficiary_user_id,
    );
    const grantedRole = metadata ? getGrantedAccessLabel(metadata) : "";
    if (target && grantedRole) {
      return `Ownership transfer requested to ${target}. Requested access: ${grantedRole}.`;
    }
    if (target) {
      return `Ownership transfer requested to ${target}`;
    }
    return "Ownership transfer requested";
  }

  if (action === "transfer.accepted") {
    const newOwner = firstNonEmpty(
      metadata?.new_owner_name,
      metadata?.new_owner_email,
      metadata?.beneficiary_name,
      metadata?.beneficiary_email,
      metadata?.new_owner_id,
      metadata?.beneficiary_user_id,
    );
    const granted = metadata ? getGrantedAccessLabel(metadata) : "";
    const disposition = getTransferDispositionLabel(
      metadata?.previous_owner_disposition || metadata?.current_owner_action,
    );

    if (newOwner && granted && disposition) {
      return `Ownership transferred to ${newOwner}. Granted access: ${granted}. Previous owner access: ${disposition}.`;
    }
    if (newOwner && granted) {
      return `Ownership transferred to ${newOwner}. Granted access: ${granted}.`;
    }
    if (newOwner) {
      return `Ownership transfer accepted by ${newOwner}`;
    }
    return "Ownership transfer accepted";
  }

  if (action === "transfer.rejected") {
    const rejectedBy = firstNonEmpty(
      metadata?.rejected_by_name,
      metadata?.rejected_by_email,
      metadata?.target_name,
      metadata?.target_email,
      metadata?.rejected_by_user_id,
      metadata?.target_user_id,
    );
    const requestedRole = metadata ? getRequestedAccessLabel(metadata) : "";

    if (rejectedBy && requestedRole) {
      return `Ownership transfer rejected by ${rejectedBy} (requested access: ${requestedRole})`;
    }
    if (rejectedBy) {
      return `Ownership transfer rejected by ${rejectedBy}`;
    }
    return "Ownership transfer rejected";
  }

  if (action === "environment.access_granted") {
    return "Environment access granted";
  }

  if (action === "environment.access_revoked") {
    return "Environment access revoked";
  }

  if (action === "environment.access_updated") {
    return "Environment access updated";
  }

  if (action === "member.invited") {
    return "Member invited";
  }

  if (action === "github.repo_linked") {
    if (metadata?.repo_full_name) {
      return `Linked repository ${metadata.repo_full_name}`;
    }
    return "Repository linked";
  }

  if (action === "github.repo_unlinked") {
    const repo = metadata?.repo_full_name
      ? `Unlinked repository ${metadata.repo_full_name}`
      : "Repository unlinked";
    const reason =
      metadata?.reason === "manual"
        ? "manual unlink"
        : metadata?.reason === "github_app_uninstalled"
          ? "GitHub App uninstalled"
          : "";
    return reason ? `${repo} (${reason})` : repo;
  }

  if (action === "github.account_connected") {
    const account = firstNonEmpty(metadata?.account_login);
    if (account) return `Connected GitHub account @${account}`;
    return "GitHub account connected";
  }

  if (action === "github.account_disconnected") {
    const account = firstNonEmpty(metadata?.account_login);
    if (account) return `Disconnected GitHub account @${account}`;
    return "GitHub account disconnected";
  }

  if (action === "AGENT_APPROVED_CHANGE") {
    const agentLabel = getFriendlyAgentLabel(metadata);
    const environment = metadata?.environment
      ? String(metadata.environment)
      : null;
    const mutationCount =
      typeof metadata?.mutation_count === "number" ? metadata.mutation_count : null;
    const envPart = environment ? ` in ${environment}` : "";

    if (mutationCount !== null) {
      return `Approved ${mutationCount} agent mutation(s) from ${agentLabel}${envPart}`;
    }
    return `Approved agent change from ${agentLabel}${envPart}`;
  }

  if (action === "AGENT_REJECTED_CHANGE") {
    const agentLabel = getFriendlyAgentLabel(metadata);
    const environment = metadata?.environment
      ? String(metadata.environment)
      : null;
    const envPart = environment ? ` in ${environment}` : "";

    return `Rejected agent change from ${agentLabel}${envPart}`;
  }

  return null;
}

export function AuditLogsView({ projectId }: AuditLogsViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [members, setMembers] = useState<ProjectMemberOption[]>([]);
  const [selectedActorId, setSelectedActorId] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memberOptions = useMemo(() => {
    const uniqueMembers = new Map<string, ProjectMemberOption>();
    for (const member of members) {
      uniqueMembers.set(member.user_id, member);
    }
    return Array.from(uniqueMembers.values());
  }, [members]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/project-members?projectId=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      // Non-blocking
    }
  }, [projectId]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedActorId !== "all") {
        params.set("actor_id", selectedActorId);
      }
      if (selectedAction !== "all") {
        params.set("action", selectedAction);
      }

      const query = params.toString();
      const url = `/api/project/${projectId}/audit-logs${query ? `?${query}` : ""}`;
      const res = await fetch(url);

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Too many requests. Please wait a moment.");
        }
        if (res.status === 403 || res.status === 401) {
          throw new Error(
            "You do not have access to this project's audit logs.",
          );
        }
        throw new Error("Failed to load audit logs");
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setExpandedRows(new Set());
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "An error occurred while fetching audit logs.");
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, selectedActorId, selectedAction]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Hybrid Realtime Sync for Audit Logs
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceTimer: NodeJS.Timeout;
    let isStale = false;

    const handleRealtimeEvent = () => {
      if (document.hasFocus()) {
        fetchLogs();
      } else {
        isStale = true;
      }
    };

    const connectRealtime = () => {
      if (channel) return;
      channel = supabase
        .channel(`project-${projectId}-audit-sync`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "audit_logs",
            filter: `project_id=eq.${projectId}`,
          },
          handleRealtimeEvent,
        )
        .subscribe((status, err) => {
          if (err) console.error("Realtime subscription error:", err);
        });
    };

    const disconnectRealtime = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const handleFocus = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isStale) {
          fetchLogs();
          isStale = false;
        }
      }, 300);
    };

    connectRealtime();

    window.addEventListener("focus", handleFocus);

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener("focus", handleFocus);
      disconnectRealtime();
    };
  }, [projectId, fetchLogs]);

  const toggleRow = (logId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  if (isLoading) {
    return <AuditLogsSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Logs</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const filters = (
    <div className="flex flex-wrap gap-2">
      <Select value={selectedActorId} onValueChange={setSelectedActorId}>
        <SelectTrigger className="h-9 w-full sm:w-auto text-sm">
          <SelectValue placeholder="Filter by user" />
        </SelectTrigger>
        <SelectContent className="max-h-64 text-sm">
          <SelectItem className="py-1.5 text-sm" value="all">
            All users
          </SelectItem>
          {memberOptions.map((member) => (
            <SelectItem
              className="py-1.5 text-sm"
              key={member.user_id}
              value={member.user_id}
            >
              <span className="flex items-center gap-2">
                <UserAvatar
                  className="h-5 w-5"
                  user={{
                    username: member.username,
                    email: member.email,
                    avatar: member.avatar,
                  }}
                />
                <span>{member.username || member.email || member.user_id}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedAction} onValueChange={setSelectedAction}>
        <SelectTrigger className="h-9 w-full sm:w-auto text-sm">
          <SelectValue placeholder="Filter by action" />
        </SelectTrigger>
        <SelectContent className="max-h-64 text-sm">
          {ACTION_OPTIONS.map((option) => (
            <SelectItem
              className="py-1.5 text-sm"
              key={option.value}
              value={option.value}
            >
              <span className="flex items-center gap-2">
                {option.value === "all" ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  getActionIcon(option.value)
                )}
                <span>{option.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (logs.length === 0) {
    return (
      <div className="space-y-4">
        {filters}
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-card/50">
          <div className="rounded-full bg-muted p-3 mb-4">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">
            No Audit Logs Found
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            There has been no recorded activity in this project yet. Actions
            like adding or deleting secrets will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filters}

      <div className="hidden md:block rounded-md border bg-card min-w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[40px]" />
              <TableHead className="w-[190px] whitespace-nowrap">
                Timestamp
              </TableHead>
              <TableHead className="w-[170px] whitespace-nowrap">
                Action
              </TableHead>
              <TableHead className="w-[240px] min-w-[180px]">Actor</TableHead>
              <TableHead className="min-w-[260px]">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const changes = log.metadata?.changes || {};
              const keyName = log.metadata?.key_name;
              const effectiveAction = getEffectiveAction(log);
              const changeEntries = Object.entries(changes);
              const transferDetailRows = getTransferDetailRows(
                effectiveAction,
                log.metadata,
              );
              const canExpand =
                changeEntries.length > 0 || transferDetailRows.length > 0;
              const isExpanded = expandedRows.has(log.id);
              const affectedUser = getBeneficiaryLabel(log.metadata);
              const actionText = getActionLabel(effectiveAction);
              const detailsSummary =
                getNonDiffContextSummary(
                  effectiveAction,
                  log.metadata,
                  keyName,
                ) ||
                (changeEntries.length > 0
                  ? getDetailSummary(changeEntries, keyName)
                  : null);
              const shouldShowAffectedUser =
                isMemberRelatedAction(effectiveAction) && Boolean(affectedUser);

              return (
                <Fragment key={log.id}>
                  <TableRow className="hover:bg-muted/25">
                    <TableCell>
                      {canExpand ? (
                        <button
                          type="button"
                          aria-label={
                            isExpanded ? "Collapse details" : "Expand details"
                          }
                          onClick={() => toggleRow(log.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      <DateDisplay
                        date={log.created_at}
                        formatType="absolute"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`font-mono font-medium text-[10px] uppercase whitespace-nowrap border ${getActionBadgeClass(effectiveAction)}`}
                      >
                        <span className="mr-1 inline-flex">
                          {getActionIcon(effectiveAction)}
                        </span>
                        {actionText}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar
                          className="h-7 w-7 shrink-0"
                          user={{
                            username: log.actor_name,
                            email: log.actor_email,
                            avatar: log.actor_avatar,
                          }}
                        />
                        <div className="flex flex-col truncate min-w-0">
                          <span className="font-medium text-foreground truncate">
                            {log.actor_name ||
                              log.actor_email ||
                              "Former Member"}
                          </span>
                          {log.actor_email && (
                            <span className="text-xs text-muted-foreground truncate">
                              {log.actor_email}
                            </span>
                          )}
                          {log.actor_type === "machine" && (
                            <span className="text-xs text-muted-foreground font-mono truncate">
                              Service Token
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        {shouldShowAffectedUser && (
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="h-3.5 w-3.5" /> Affected User:{" "}
                            {affectedUser}
                          </span>
                        )}
                        {detailsSummary ? (
                          <span>{detailsSummary}</span>
                        ) : (
                          <span>
                            {canExpand ? "Expand row to view details" : "-"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {canExpand && isExpanded && (
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={5}>
                        <div className="py-2 pl-10 pr-2 space-y-2">
                          {changeEntries.map(([field, change]) => (
                            <div
                              key={field}
                              className="text-sm flex flex-wrap items-center gap-2"
                            >
                              <span className="font-medium text-foreground">
                                {formatFieldLabel(field, keyName)}:
                              </span>
                              {field === "value" &&
                              isRedactedPair(change.old, change.new) ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                                  Value updated
                                </span>
                              ) : (
                                <>
                                  <span className="text-muted-foreground line-through">
                                    {formatDiffValue(change.old)}
                                  </span>
                                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-foreground font-medium">
                                    {formatDiffValue(change.new)}
                                  </span>
                                </>
                              )}
                            </div>
                          ))}
                          {transferDetailRows.map((row) => (
                            <div
                              key={`${row.label}-${row.value}`}
                              className="text-sm"
                            >
                              <span className="font-medium text-foreground">
                                {row.label}:{" "}
                              </span>
                              <span className="text-muted-foreground break-words">
                                {row.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-4">
        {logs.map((log) => {
          const changes = log.metadata?.changes || {};
          const keyName = log.metadata?.key_name;
          const effectiveAction = getEffectiveAction(log);
          const changeEntries = Object.entries(changes);
          const transferDetailRows = getTransferDetailRows(
            effectiveAction,
            log.metadata,
          );
          const canExpand =
            changeEntries.length > 0 || transferDetailRows.length > 0;
          const isExpanded = expandedRows.has(log.id);
          const affectedUser = getBeneficiaryLabel(log.metadata);
          const actionText = getActionLabel(effectiveAction);
          const detailsSummary =
            getNonDiffContextSummary(effectiveAction, log.metadata, keyName) ||
            (changeEntries.length > 0
              ? getDetailSummary(changeEntries, keyName)
              : null);
          const shouldShowAffectedUser =
            isMemberRelatedAction(effectiveAction) && Boolean(affectedUser);

          return (
            <div
              key={log.id}
              className="p-4 bg-card rounded-xl border shadow-sm flex flex-col gap-3"
            >
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div className="flex items-center gap-2">
                  {canExpand ? (
                    <button
                      type="button"
                      aria-label={
                        isExpanded ? "Collapse details" : "Expand details"
                      }
                      onClick={() => toggleRow(log.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  ) : null}
                  <Badge
                    variant="secondary"
                    className={`font-mono font-medium text-[10px] uppercase border ${getActionBadgeClass(effectiveAction)}`}
                  >
                    <span className="mr-1 inline-flex">
                      {getActionIcon(effectiveAction)}
                    </span>
                    {actionText}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                  <DateDisplay date={log.created_at} formatType="absolute" />
                </span>
              </div>

              <div className="flex items-center gap-2 bg-muted/40 rounded-lg p-3">
                <UserAvatar
                  className="h-7 w-7 shrink-0"
                  user={{
                    username: log.actor_name,
                    email: log.actor_email,
                    avatar: log.actor_avatar,
                  }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-sm text-foreground truncate">
                    {log.actor_name || log.actor_email || "Former Member"}
                  </span>
                  <div className="flex items-center gap-2 text-xs truncate">
                    {log.actor_email && (
                      <span className="text-muted-foreground truncate">
                        {log.actor_email}
                      </span>
                    )}
                    {log.actor_type === "machine" && (
                      <span className="text-muted-foreground font-mono truncate">
                        Service Token
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {(shouldShowAffectedUser || detailsSummary || canExpand) && (
                <div className="text-sm text-muted-foreground space-y-1">
                  {shouldShowAffectedUser && (
                    <div className="inline-flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" /> Affected User:{" "}
                      {affectedUser}
                    </div>
                  )}
                  {detailsSummary ? <div>{detailsSummary}</div> : null}
                  {!detailsSummary && canExpand ? (
                    <div>Expand row to view details</div>
                  ) : null}
                </div>
              )}

              {canExpand && isExpanded && (
                <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  {changeEntries.map(([field, change]) => (
                    <div
                      key={field}
                      className="text-sm flex flex-wrap items-center gap-2"
                    >
                      <span className="font-medium text-foreground">
                        {formatFieldLabel(field, keyName)}:
                      </span>
                      {field === "value" &&
                      isRedactedPair(change.old, change.new) ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                          Value updated
                        </span>
                      ) : (
                        <>
                          <span className="text-muted-foreground line-through">
                            {formatDiffValue(change.old)}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-foreground font-medium">
                            {formatDiffValue(change.new)}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                  {transferDetailRows.map((row) => (
                    <div key={`${row.label}-${row.value}`} className="text-sm">
                      <span className="font-medium text-foreground">
                        {row.label}:{" "}
                      </span>
                      <span className="text-muted-foreground break-words">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

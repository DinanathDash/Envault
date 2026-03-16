"use client";

import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AuditLogsSkeleton } from "./audit-logs-skeleton";
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
  KeyRound,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
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
  beneficiary_user_id?: string;
  beneficiary_name?: string;
  beneficiary_email?: string;
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
  { value: "environment.access_updated", label: "Environment Access Updated" },
  { value: "environment.access_granted", label: "Environment Access Granted" },
  { value: "environment.access_revoked", label: "Environment Access Revoked" },
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
  if (action === "environment.access_updated")
    return <RefreshCw className="h-3.5 w-3.5" />;
  if (action === "environment.access_granted")
    return <ShieldCheck className="h-3.5 w-3.5" />;
  if (action === "environment.access_revoked")
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
              const changeEntries = Object.entries(changes);
              const canExpand = changeEntries.length > 0;
              const isExpanded = expandedRows.has(log.id);
              const affectedUser = getBeneficiaryLabel(log.metadata);
              const effectiveAction = getEffectiveAction(log);
              const actionText = getActionLabel(effectiveAction);
              const detailsSummary =
                getNonDiffContextSummary(
                  effectiveAction,
                  log.metadata,
                  keyName,
                ) ||
                (!canExpand ? getDetailSummary(changeEntries, keyName) : null);
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
                            isExpanded ? "Collapse diff" : "Expand diff"
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
                            {canExpand ? "Expand row to view changes" : "-"}
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
          const changeEntries = Object.entries(changes);
          const canExpand = changeEntries.length > 0;
          const isExpanded = expandedRows.has(log.id);
          const affectedUser = getBeneficiaryLabel(log.metadata);
          const effectiveAction = getEffectiveAction(log);
          const actionText = getActionLabel(effectiveAction);
          const detailsSummary =
            getNonDiffContextSummary(effectiveAction, log.metadata, keyName) ||
            (!canExpand ? getDetailSummary(changeEntries, keyName) : null);
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
                      aria-label={isExpanded ? "Collapse diff" : "Expand diff"}
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
                    <div>Expand row to view changes</div>
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

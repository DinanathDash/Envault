"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Copy, Share2, Check, CornerDownLeft, Loader2, ChevronDown } from "lucide-react";
import { MemberSkeleton } from "@/components/notifications/notification-skeleton";
import {
  inviteUser,
  approveRequest,
  rejectRequest,
  updateMemberRole,
  removeMember,
} from "@/app/invite-actions";
import { Project } from "@/lib/store";
import {
  ShareConfirmationDialog,
  PendingChange,
} from "./share-confirmation-dialog";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { Kbd } from "@/components/ui/kbd";
import { getModifierKey } from "@/lib/utils";
import { formatEnvironmentLabel } from "@/lib/environment-label";

interface ShareProjectDialogProps {
  project: Project;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "viewer" | "editor";
  created_at: string;
  email?: string;
  avatar?: string;
  username?: string;
  allowed_environments?: string[] | null;
}

interface PendingRequest {
  id: string;
  user_id: string;
  project_id: string;
  status: string;
  created_at: string;
  requested_environment?: string | null;
  email?: string;
  avatar?: string;
  username?: string;
}

const areEnvironmentsEqual = (
  a: string[] | null | undefined,
  b: string[] | null | undefined,
  allEnvs: string[]
) => {
  const normalizedA = [...(a === null || a === undefined ? allEnvs : a)].sort();
  const normalizedB = [...(b === null || b === undefined ? allEnvs : b)].sort();
  if (normalizedA.length !== normalizedB.length) return false;
  return normalizedA.every((val, index) => val === normalizedB[index]);
};

export function ShareProjectDialog({
  project,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ShareProjectDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Track pending changes
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, PendingChange>
  >(new Map());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [applying, setApplying] = useState(false);

  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [shakeIds, setShakeIds] = useState<Set<string>>(new Set());
  const [modalShake, setModalShake] = useState(false);

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedMembers((prev) => {
      if (prev.has(id)) return new Set();
      return new Set([id]);
    });
  };

  const isOwner = project.role === "owner" || !project.role;
  const hasChanges = pendingChanges.size > 0;

  const fetchMembersAndRequests = useCallback(async () => {
    setMembersLoading(true);
    try {
      const response = await fetch(
        `/api/project-members?projectId=${project.id}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }
      const { members, requests } = (await response.json()) as {
        members?: Array<Record<string, unknown>>;
        requests?: Array<Record<string, unknown>>;
      };
      setMembers((members || []) as unknown as Member[]);
      setPendingRequests((requests || []) as unknown as PendingRequest[]);
    } catch (error) {
      console.error("Failed to fetch members and requests:", error);
    } finally {
      setMembersLoading(false);
      setPendingChanges(new Map()); // Reset changes on refresh
    }
  }, [project.id]);

  useEffect(() => {
    if (open) {
      fetchMembersAndRequests();
    }
  }, [open, fetchMembersAndRequests]);

  const handleInvite = async () => {
    if (!email) return;
    setLoading(true);

    const result = await inviteUser(project.id, email);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Invitation sent!");
      setEmail("");
    }
    setLoading(false);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/join/${project.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 5000);
  };

  const handleRequestAction = (
    request: PendingRequest,
    action: "pending" | "approve" | "deny",
  ) => {
    const newChanges = new Map(pendingChanges);

    if (action === "pending") {
      // Remove change if set back to pending
      newChanges.delete(request.user_id);
      setExpandedMembers(prev => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    } else {
      const existingChange = newChanges.get(request.user_id);
      const existingMember = members.find((m) => m.user_id === request.user_id);
      const existingMemberEnvs =
        existingMember &&
        existingMember.allowed_environments !== null &&
        existingMember.allowed_environments !== undefined
          ? existingMember.allowed_environments
          : getAllProjectEnvSlugs();
      const requestedEnvDefault =
        action === "approve" && request.requested_environment
          ? [request.requested_environment]
          : undefined;
      const mergedDefaultEnvs =
        action === "approve"
          ? Array.from(
              new Set([
                ...(existingMemberEnvs || []),
                ...(requestedEnvDefault || []),
              ]),
            )
          : undefined;
      const fallbackRole: "viewer" | "editor" =
        existingMember?.role === "editor" ? "editor" : "viewer";
      newChanges.set(request.user_id, {
        userId: request.user_id,
        type: action,
        currentRole: "pending",
        newRole:
          action === "approve"
            ? (existingChange?.newRole || fallbackRole)
            : undefined,
        email: request.email,
        avatar: request.avatar,
        requestId: request.id,
        allowedEnvironments:
          action === "approve"
            ? (existingChange?.allowedEnvironments || mergedDefaultEnvs)
            : undefined,
      });

      if (action === "approve") {
        setExpandedMembers(new Set([request.id]));
      } else {
        setExpandedMembers(prev => {
          const next = new Set(prev);
          next.delete(request.id);
          return next;
        });
      }
    }

    setPendingChanges(newChanges);
  };

  const handleMemberRoleChange = (
    member: Member,
    newValue: "viewer" | "editor" | "revoke",
  ) => {
    if (member.role === "owner") return; // Secure guard
    const newChanges = new Map(pendingChanges);
    const existingChange = newChanges.get(member.user_id);
    const allEnvs = project.environments?.map((e) => e.slug) || [];

    if (newValue === member.role) {
      if (
        existingChange?.allowedEnvironments !== undefined &&
        !areEnvironmentsEqual(existingChange.allowedEnvironments, member.allowed_environments, allEnvs)
      ) {
        newChanges.set(member.user_id, {
          ...existingChange,
          type: "role_change",
          newRole: member.role,
        });
      } else {
        newChanges.delete(member.user_id);
      }
    } else if (newValue === "revoke") {
      newChanges.set(member.user_id, {
        userId: member.user_id,
        type: "revoke",
        currentRole: member.role,
        email: member.email,
        avatar: member.avatar,
      });
    } else {
      newChanges.set(member.user_id, {
        userId: member.user_id,
        type: "role_change",
        currentRole: member.role,
        newRole: newValue,
        email: member.email,
        avatar: member.avatar,
        allowedEnvironments: existingChange?.allowedEnvironments,
      });
    }

    setPendingChanges(newChanges);
  };

  const handleModifyEnvironments = (
    member: Member,
    newEnvironments: string[] | null
  ) => {
    if (member.role === "owner") return;

    const newChanges = new Map(pendingChanges);
    const existingChange = newChanges.get(member.user_id);
    const allEnvs = project.environments?.map((e) => e.slug) || [];

    const isRoleSame = !existingChange || (existingChange.type === "role_change" && existingChange.newRole === member.role);
    
    if (isRoleSame && areEnvironmentsEqual(newEnvironments, member.allowed_environments, allEnvs)) {
      newChanges.delete(member.user_id);
    } else if (existingChange) {
      newChanges.set(member.user_id, {
        ...existingChange,
        allowedEnvironments: newEnvironments || undefined,
      });
    } else {
      newChanges.set(member.user_id, {
        userId: member.user_id,
        type: "role_change",
        currentRole: member.role,
        newRole: member.role,
        email: member.email,
        avatar: member.avatar,
        allowedEnvironments: newEnvironments || undefined,
      });
    }

    setPendingChanges(newChanges);
  };

  const handleSave = () => {
    // Validate that all "approve" and "role_change" actions have a valid role
    const invalidRoleChanges = Array.from(pendingChanges.values()).filter(
      (c) => c.type === "approve" && !c.newRole
    );

    // Validate that advanced projects with environments selected don't leave members with 0 environments
    // but only validate if the role isn't 'revoke' and it's an advanced project
    const invalidEnvChanges = project.ui_mode === "advanced" && project.environments && project.environments.length > 0
      ? Array.from(pendingChanges.values()).filter(
        (c) => {
          if (c.type === "revoke") return false;
          // For active members (role_change) or approves, they must end up with at least 1 env
          if (c.type === "approve" || c.type === "role_change") {
            // If they explicitly wiped out environments, flag them
            if (c.allowedEnvironments !== undefined && c.allowedEnvironments.length === 0) return true;
          }
          return false;
        }
      )
      : [];

    const allInvalidChanges = [...invalidRoleChanges, ...invalidEnvChanges];

    if (allInvalidChanges.length > 0) {
      const firstInvalidId = allInvalidChanges[0].requestId || allInvalidChanges[0].userId; // active members use userId for the accordion ID

      if (firstInvalidId) {
        setExpandedMembers(new Set([firstInvalidId]));
      }
      const invalidUserIds = new Set(allInvalidChanges.map(c => c.userId));
      setShakeIds(invalidUserIds);
      setTimeout(() => setShakeIds(new Set()), 500);
      toast.error("Please explicitly assign a role and at least one environment to all active members.");
      return;
    }

    setShowConfirmation(true);
  };

  const applyChanges = async () => {
    setApplying(true);
    const changes = Array.from(pendingChanges.values());
    let successCount = 0;
    let errorCount = 0;

    for (const change of changes) {
      try {
        switch (change.type) {
          case "approve": {
            const res = await approveRequest(
              change.requestId!,
                change.newRole || "viewer",
              true,
              change.allowedEnvironments
            );
            if (res?.error) throw new Error(res.error);
            break;
          }
          case "deny": {
            const res = await rejectRequest(change.requestId!);
            if (res?.error) throw new Error(res.error);
            break;
          }
          case "role_change": {
            const res = await updateMemberRole(
              project.id,
              change.userId,
              change.newRole!,
              change.allowedEnvironments
            );
            if (res?.error) throw new Error(res.error);
            break;
          }
          case "revoke": {
            const res = await removeMember(project.id, change.userId);
            if (res?.error) throw new Error(res.error);
            break;
          }
        }
        successCount++;
      } catch (error) {
        console.error("Failed to apply change:", error);
        errorCount++;
      }
    }

    setApplying(false);
    setShowConfirmation(false);

    if (errorCount === 0) {
      toast.success(
        `Successfully applied ${successCount} change${successCount !== 1 ? "s" : ""}`,
      );
    } else {
      toast.error(`Applied ${successCount} changes, ${errorCount} failed`);
    }

    await fetchMembersAndRequests();

    // Notify dashboard to refresh projects
    document.dispatchEvent(new CustomEvent("project-role-changed"));
  };

  const getCurrentValue = (
    userId: string,
    originalValue: string | undefined,
  ): string => {
    const change = pendingChanges.get(userId);
    if (!change) return originalValue || "";

    if (change.type === "approve") return "approve";
    if (change.type === "deny") return "deny";
    if (change.type === "revoke") return "revoke";
    if (change.type === "role_change") return change.newRole!;

    return originalValue || "";
  };

  const getAllProjectEnvSlugs = () =>
    project.environments?.map((e) => e.slug) || [];

  const getCurrentEnvironments = (
    userId: string,
    originalEnv: string[] | null | undefined
  ): string[] => {
    const change = pendingChanges.get(userId);
    if (change && change.allowedEnvironments !== undefined) {
      return change.allowedEnvironments;
    }
    return originalEnv === null || originalEnv === undefined
      ? getAllProjectEnvSlugs()
      : originalEnv;
  };

  // Shortcut for saving changes
  useHotkeys(
    "mod+s",
    (e) => {
      if (open && isOwner && hasChanges) {
        e.preventDefault();
        handleSave();
      }
    },
    { enableOnContentEditable: true, enableOnFormTags: true },
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {children ? (
          <DialogTrigger asChild>{children}</DialogTrigger>
        ) : !isControlled ? (
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
          </DialogTrigger>
        ) : null}
        <DialogContent
          className={`w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto ${modalShake ? 'animate-shake-dialog' : ''}`}
          onInteractOutside={(e) => {
            if (hasChanges) {
              e.preventDefault();
              toast.error("You have unsaved changes. Discard changes to proceed to the dashboard.");
              setModalShake(false);
              setTimeout(() => {
                setModalShake(true);
                setTimeout(() => setModalShake(false), 400);
              }, 10);
            }
          }}
          onEscapeKeyDown={(e) => {
            if (hasChanges) {
              e.preventDefault();
              toast.error("You have unsaved changes. Discard changes to proceed to the dashboard.");
              setModalShake(false);
              setTimeout(() => {
                setModalShake(true);
                setTimeout(() => setModalShake(false), 400);
              }, 10);
            }
          }}
          onCloseClick={(e) => {
            if (hasChanges) {
              e.preventDefault();
              toast.error("You have unsaved changes. Discard changes to proceed to the dashboard.");
              setModalShake(false);
              setTimeout(() => {
                setModalShake(true);
                setTimeout(() => setModalShake(false), 400);
              }, 10);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              Share {project.name}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Invite collaborators to this project.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="invite" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="invite">Invite</TabsTrigger>
              <TabsTrigger value="members">
                Members
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invite" className="space-y-4 pt-4">
              <div className="flex flex-row gap-2">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="link" className="sr-only">
                    Link
                  </Label>
                  <Input
                    id="link"
                    defaultValue={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${project.id}`}
                    readOnly
                    className="text-xs sm:text-sm"
                  />
                </div>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="border-t my-4" />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleInvite();
                }}
                className="flex flex-col space-y-2"
              >
                <Label className="text-sm">Invite by Email</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="colleague@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={loading || !email}
                    className="sm:w-auto"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <span className="flex items-center gap-2">
                        Send Invitation{" "}
                        <span className="flex items-center gap-1">
                          <Kbd className="bg-primary-foreground/20 text-primary-foreground border-0">
                            {getModifierKey("mod")}
                          </Kbd>
                          <Kbd className="bg-primary-foreground/20 text-primary-foreground border-0">
                            <CornerDownLeft className="w-3 h-3" />
                          </Kbd>
                        </span>
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="members" className="pt-4 space-y-4">
              <div className="space-y-4">
                {membersLoading ? (
                  <MemberSkeleton />
                ) : members.length === 0 && pendingRequests.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No members yet.
                  </div>
                ) : (
                  <>
                    {/* Pending Requests */}
                    {pendingRequests.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">
                          Pending Requests
                        </h4>
                        <div className="grid gap-2">
                          {pendingRequests.map((request) => {
                            const isExpanded = expandedMembers.has(request.id);
                            const currentAction = getCurrentValue(request.user_id, "pending");
                            const existingChange = pendingChanges.get(request.user_id);
                            const existingMember = members.find((m) => m.user_id === request.user_id);
                            const currentRole = existingChange?.newRole || existingMember?.role || "viewer";
                            const baseRequestEnvs =
                              existingMember &&
                              existingMember.allowed_environments !== null &&
                              existingMember.allowed_environments !== undefined
                                ? existingMember.allowed_environments
                                : getAllProjectEnvSlugs();
                            const currentEnvs = existingChange?.allowedEnvironments || baseRequestEnvs || [];

                            return (
                              <div key={request.id} className={`flex flex-col border rounded-lg overflow-hidden transition-all bg-muted/30 ${shakeIds.has(request.user_id) ? "animate-shake border-destructive/50 ring-1 ring-destructive/50" : ""}`}>
                                <div
                                  className={`flex flex-row items-center p-3 gap-3 w-full ${currentAction === "approve" ? "cursor-pointer hover:bg-muted/50" : ""}`}
                                  onClick={(e) => {
                                    if (currentAction === "approve") toggleExpand(e, request.id);
                                  }}
                                >
                                  <UserAvatar className="h-8 w-8 shrink-0" user={{ email: request.email || "unknown", avatar: request.avatar }} />
                                  
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="flex-1 min-w-0 [mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent_100%)]">
                                      <p className="text-sm font-medium leading-none whitespace-nowrap overflow-hidden">
                                        <span className="sm:hidden">{request.username || request.email || "Unknown User"}</span>
                                        <span className="hidden sm:inline">{request.email || "Unknown User"}</span>
                                      </p>
                                      {request.requested_environment && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Requested environment:{" "}
                                          <span className="font-medium">
                                            {formatEnvironmentLabel(request.requested_environment)}
                                          </span>
                                        </p>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center space-x-2 shrink-0">
                                      {isOwner && (
                                        <Select
                                          value={currentAction}
                                          onValueChange={(value: "pending" | "approve" | "deny") => handleRequestAction(request, value)}
                                        >
                                          <SelectTrigger className="w-[100px] h-8 text-xs sm:text-sm sm:h-9 sm:w-32" onClick={(e) => e.stopPropagation()}>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="approve">Approve</SelectItem>
                                            <SelectItem value="deny" className="text-destructive focus:bg-destructive/10">Deny</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      )}
                                      {currentAction === "approve" && (
                                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Expanded Content */}
                                {currentAction === "approve" && (
                                  <div className={`grid transition-all duration-200 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                                    <div className="overflow-hidden">
                                      <div className="p-3 pt-2 flex flex-col gap-4 border-t bg-muted/10 mt-2">
                                        <div className="flex flex-col gap-2">
                                          <label className="text-sm font-medium">Assign Role</label>
                                          <Select
                                            value={currentRole as string}
                                            onValueChange={(value: "viewer" | "editor") => {
                                              const newChanges = new Map(pendingChanges);
                                              const c = newChanges.get(request.user_id);
                                              if (c) {
                                                newChanges.set(request.user_id, { ...c, newRole: value });
                                                setPendingChanges(newChanges);
                                              }
                                            }}
                                          >
                                            <SelectTrigger className="w-full">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="viewer">Viewer</SelectItem>
                                              <SelectItem value="editor">Editor</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        {project.ui_mode === "advanced" && project.environments && project.environments.length > 0 && (
                                          <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium">Environment Access</label>
                                            <div className="flex flex-row flex-wrap gap-4 items-center rounded-md border border-input bg-background px-3 py-3 text-sm">
                                              {getAllProjectEnvSlugs().map((env) => {
                                                const isChecked = currentEnvs.includes(env);
                                                return (
                                                  <div key={`pending-${request.id}-${env}`} className="flex items-center space-x-2">
                                                    <Checkbox
                                                      id={`pending-${request.id}-${env}`}
                                                      className="rounded border-2"
                                                      checked={isChecked}
                                                      onCheckedChange={(checked) => {
                                                        const newChanges = new Map(pendingChanges);
                                                        const c = newChanges.get(request.user_id);
                                                        
                                                        let nextEnvs;
                                                        if (checked) {
                                                          nextEnvs = [...currentEnvs, env];
                                                        } else {
                                                          nextEnvs = currentEnvs.filter((e) => e !== env);
                                                        }

                                                        if (c) {
                                                          newChanges.set(request.user_id, {
                                                            ...c,
                                                            allowedEnvironments: nextEnvs,
                                                          });
                                                          setPendingChanges(newChanges);
                                                        }
                                                      }}
                                                    />
                                                    <label
                                                      htmlFor={`pending-${request.id}-${env}`}
                                                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-medium capitalize cursor-pointer"
                                                    >
                                                      {env}
                                                    </label>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Active Members */}
                    {members.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Active Members</h4>
                        <div className="grid gap-2">
                          {members.map((member) => {
                            const isExpanded = expandedMembers.has(member.id);
                            const currentRole = getCurrentValue(member.user_id, member.role);
                            const currentEnvs = getCurrentEnvironments(member.user_id, member.allowed_environments);
                            const isOwnerRole = currentRole === "owner";

                            return (
                              <div key={member.id} className={`flex flex-col border rounded-lg overflow-hidden transition-all bg-card ${shakeIds.has(member.user_id) ? "animate-shake border-destructive/50 ring-1 ring-destructive/50" : ""}`}>
                                <div
                                  className={`flex flex-row items-center p-3 gap-3 w-full ${!isOwnerRole && isOwner ? "cursor-pointer hover:bg-muted/50" : ""}`}
                                  onClick={(e) => {
                                    if (!isOwnerRole && isOwner) toggleExpand(e, member.id);
                                  }}
                                >
                                  <UserAvatar className="h-8 w-8 shrink-0" user={{ email: member.email || "unknown", avatar: member.avatar }} />
                                  
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="flex-1 min-w-0 [mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent_100%)]">
                                      <p className="text-sm font-medium leading-none whitespace-nowrap overflow-hidden">
                                        <span className="sm:hidden">{member.username || member.email || "Unknown User"}</span>
                                        <span className="hidden sm:inline">{member.email || "Unknown User"}</span>
                                      </p>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2 shrink-0">
                                      <Badge variant={isOwnerRole ? "default" : "outline"} className="capitalize shrink-0">
                                        {currentRole === "revoke" ? "revoking" : currentRole}
                                      </Badge>
                                      {isOwner && !isOwnerRole && (
                                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Expanded Content */}
                                {isOwner && !isOwnerRole && (
                                  <div className={`grid transition-all duration-200 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                                    <div className="overflow-hidden">
                                      <div className="p-3 pt-2 flex flex-col gap-4 border-t bg-muted/10 mt-2">
                                        <div className="flex flex-col gap-2">
                                          <label className="text-sm font-medium">Assign Role</label>
                                          <Select
                                            value={currentRole}
                                            onValueChange={(value: "viewer" | "editor" | "revoke") => handleMemberRoleChange(member, value)}
                                          >
                                            <SelectTrigger className="w-full">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="viewer">Viewer</SelectItem>
                                              <SelectItem value="editor">Editor</SelectItem>
                                              <SelectItem value="revoke" className="text-destructive focus:bg-destructive/10">Revoke Access</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        {project.ui_mode === "advanced" && project.environments && project.environments.length > 0 && currentRole !== "revoke" && (
                                          <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium">Environment Access</label>
                                            <div className="flex flex-row flex-wrap gap-4 items-center rounded-md border border-input bg-background px-3 py-3 text-sm">
                                              {getAllProjectEnvSlugs().map((env) => {
                                                const isChecked = currentEnvs.includes(env);
                                                return (
                                                  <div key={`active-${member.id}-${env}`} className="flex items-center space-x-2">
                                                    <Checkbox
                                                      id={`active-${member.id}-${env}`}
                                                      className="rounded border-1"
                                                      checked={isChecked}
                                                      onCheckedChange={(checked) => {
                                                        let nextEnvs;
                                                        if (checked) {
                                                          nextEnvs = [...currentEnvs, env];
                                                        } else {
                                                          nextEnvs = currentEnvs.filter((e) => e !== env);
                                                        }
                                                        handleModifyEnvironments(member, nextEnvs);
                                                      }}
                                                    />
                                                    <label
                                                      htmlFor={`active-${member.id}-${env}`}
                                                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-medium capitalize cursor-pointer"
                                                    >
                                                      {env}
                                                    </label>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Save Button */}
                    {isOwner && (
                      <div className="flex gap-2 w-full">
                        <Button
                          variant="secondary"
                          className="flex-1 border-red-500 text-red-500 hover:bg-red-100"
                          onClick={() => setPendingChanges(new Map())}
                          disabled={!hasChanges || applying}
                        >
                          Discard Changes
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={handleSave}
                          disabled={!hasChanges || applying}
                        >
                          {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {applying ? "Saving..." : "Save Changes"}
                          {!applying && (
                            <span className="ml-2 flex items-center gap-1">
                              <Kbd className="bg-primary-foreground/20 text-primary-foreground border-0">
                                {getModifierKey("mod")}
                              </Kbd>
                              <Kbd className="bg-primary-foreground/20 text-primary-foreground border-0">
                                S
                              </Kbd>
                            </span>
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog >

      <ShareConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        changes={Array.from(pendingChanges.values())}
        onConfirm={applyChanges}
        loading={applying}
      />
    </>
  );
}

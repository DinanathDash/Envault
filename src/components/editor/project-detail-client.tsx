"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Upload,
  Download,
  Settings,
  Share2,
  Trash2,
  CornerDownLeft,
  Command,
  Copy,
  Check,
  Info,
  ArrowRightLeft,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EnvVarTable } from "@/components/editor/env-var-table";
import { EnvVarTableSkeleton } from "@/components/editor/env-var-table-skeleton";
import { VariableDialog } from "@/components/dialogs/add-variable-dialog";
import { ImportEnvDialog } from "@/components/dialogs/import-env-dialog";
import { Project, useEnvaultStore } from "@/lib/stores/store";
import { createClient } from "@/lib/supabase/client";
import { triggerHaptic } from "@/lib/haptic";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  deleteProject as deleteProjectAction,
  logSecretBatchRead,
} from "@/app/project-actions";
import { createAccessRequest } from "@/app/invite-actions";
import { ShareProjectDialog } from "@/components/dialogs/share-project-dialog";
import { RenameProjectDialog } from "@/components/dialogs/rename-project-dialog";
import { GitHubIntegrationDialog } from "@/components/dialogs/github-integration-dialog";
import { TransferOwnershipDialog } from "@/components/dialogs/transfer-ownership-dialog";
import { AppHeader } from "@/components/dashboard/ui/app-header";
import { Edit3, Github, Loader2, ShieldCheck } from "lucide-react";
import { formatEnvironmentLabel } from "@/lib/utils/environment-label";

interface ProjectDetailClientProps {
  project: Project;
}

const ModKey = () => (
  <>
    <Command className="w-3 h-3 mac-only" />
    <span className="non-mac-only">Ctrl</span>
  </>
);

export function ProjectDetailClient({ project }: ProjectDetailClientProps) {
  const router = useRouter();
  const projectId = project.id;
  const { deleteProject } = useEnvaultStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [idCopied, setIdCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const activeEnvironment = project.active_environment_slug || "development";
  const [optimisticEnv, setOptimisticEnv] = useState(activeEnvironment);
  const [isPending, startTransition] = React.useTransition();

  useEffect(() => {
    setOptimisticEnv(activeEnvironment);
  }, [activeEnvironment]);

  // Hybrid Realtime Sync for Editor
  const refreshSecrets = React.useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceTimer: NodeJS.Timeout;
    let isStale = false; // Tracks if DB changed while we were hidden

    const handleRealtimeEvent = () => {
      if (document.hasFocus()) {
        refreshSecrets();
      } else {
        isStale = true; // Mark as stale, fetch when we return
      }
    };

    const connectRealtime = () => {
      if (channel) return;
      channel = supabase
        .channel(`project-${projectId}-sync`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "secrets",
            filter: `project_id=eq.${projectId}`,
          },
          handleRealtimeEvent,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "environments",
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
          refreshSecrets();
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
  }, [projectId, refreshSecrets]);

  const isAdvancedMode = project.ui_mode === "advanced";
  const availableEnvironments = React.useMemo(
    () => project.environments || [],
    [project.environments],
  );
  const activeEnvironmentConfig = React.useMemo(
    () =>
      availableEnvironments.find((env) => env.slug === optimisticEnv) ||
      availableEnvironments.find((env) => env.slug === activeEnvironment),
    [availableEnvironments, optimisticEnv, activeEnvironment],
  );
  const hasEnvironmentAccess = activeEnvironmentConfig?.can_access !== false;

  const canEdit = project.role === "owner" || project.role === "editor";
  const canEditEnvironment = canEdit && hasEnvironmentAccess;
  const projectBasePath =
    project.owner_username && project.role !== "owner"
      ? `/${project.owner_username}/${project.slug}`
      : `/project/${project.slug}`;

  useEffect(() => {
    if (!isAdvancedMode || availableEnvironments.length === 0) return;
    availableEnvironments.forEach((env) => {
      router.prefetch(`${projectBasePath}?env=${encodeURIComponent(env.slug)}`);
    });
  }, [isAdvancedMode, availableEnvironments, router, projectBasePath]);

  // Listen for global command context
  useEffect(() => {
    const handleOpenAdd = () => {
      if (!canEditEnvironment) return;
      setIsAddDialogOpen(true);
    };
    const handleDownload = () => {
      if (!hasEnvironmentAccess) {
        toast.error(
          `You don't have access to the ${formatEnvironmentLabel(optimisticEnv)} environment.`,
        );
        return;
      }
      const btn = document.getElementById("download-env-btn");
      if (btn) btn.click();
    };
    const handleOpenImport = () => {
      if (!canEditEnvironment) return;
      setIsImportDialogOpen(true);
    };
    const handleOpenShare = () => {
      if (!canEdit) return;
      setShareDialogOpen(true);
    };
    const handleUniversalDelete = () => {
      if (project.role !== "owner") return;
      setDeleteDialogOpen(true);
    };

    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent;
      const index = customEvent.detail.index;
      if (
        isAdvancedMode &&
        availableEnvironments.length > 0 &&
        index >= 0 &&
        index < availableEnvironments.length
      ) {
        const envSlug = availableEnvironments[index].slug;
        setOptimisticEnv(envSlug);
        startTransition(() => {
          router.replace(
            `${projectBasePath}?env=${encodeURIComponent(envSlug)}`,
            { scroll: false },
          );
        });
      }
    };

    document.addEventListener("open-new-variable", handleOpenAdd);
    document.addEventListener("universal-new", handleOpenAdd);
    document.addEventListener("universal-download", handleDownload);
    document.addEventListener("universal-import", handleOpenImport);
    document.addEventListener("universal-share", handleOpenShare);
    document.addEventListener("universal-delete", handleUniversalDelete);
    document.addEventListener("switch-tab", handleSwitchTab);

    return () => {
      document.removeEventListener("open-new-variable", handleOpenAdd);
      document.removeEventListener("universal-new", handleOpenAdd);
      document.removeEventListener("universal-download", handleDownload);
      document.removeEventListener("universal-import", handleOpenImport);
      document.removeEventListener("universal-share", handleOpenShare);
      document.removeEventListener("universal-delete", handleUniversalDelete);
      document.removeEventListener("switch-tab", handleSwitchTab);
    };
  }, [
    project.role,
    canEdit,
    canEditEnvironment,
    hasEnvironmentAccess,
    isAdvancedMode,
    availableEnvironments,
    projectBasePath,
    router,
    optimisticEnv,
  ]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setDeleteConfirmation("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    triggerHaptic("light");
    setIsDeleting(true);
    const result = await deleteProjectAction(project.id);
    if (result.error) {
      triggerHaptic("error");
      toast.error(result.error);
      setIsDeleting(false);
      return;
    }
    deleteProject(project.id);
    triggerHaptic("cancel");
    toast.success("Project deleted");
    setDeleteDialogOpen(false);
    router.push("/dashboard");
  };

  const [projectNameCopied, setProjectNameCopied] = useState(false);

  const handleCopyProjectName = async () => {
    try {
      await navigator.clipboard.writeText(project.name);
      setProjectNameCopied(true);
      setTimeout(() => setProjectNameCopied(false), 2000);
    } catch {
      toast.error("Failed to copy project name");
    }
  };

  const handleDownloadEnv = async () => {
    if (!hasEnvironmentAccess) {
      toast.error(
        `You don't have access to the ${formatEnvironmentLabel(optimisticEnv)} environment.`,
      );
      return;
    }

    try {
      await logSecretBatchRead(
        projectId,
        project.variables.length,
        optimisticEnv,
        "web_ui_download",
      );
    } catch (error) {
      console.warn("Failed to write download audit log:", error);
    }

    const content = [...project.variables]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((v) => `${v.key}=${v.value}`)
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, "-")}.env`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "github_linked") {
      sessionStorage.setItem("open_github_dialog", "1");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (sessionStorage.getItem("open_github_dialog")) {
      sessionStorage.removeItem("open_github_dialog");
      setTimeout(() => setGithubDialogOpen(true), 0);
    }
  }, []);

  const handleEnvironmentChange = (envSlug: string) => {
    if (!isAdvancedMode) return;
    setOptimisticEnv(envSlug);
    startTransition(() => {
      router.replace(`${projectBasePath}?env=${encodeURIComponent(envSlug)}`, {
        scroll: false,
      });
    });
  };

  const handleRequestAccess = async () => {
    setIsRequestingAccess(true);
    try {
      const result = await createAccessRequest(project.id, optimisticEnv);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result?.message ||
          `Access request sent for ${formatEnvironmentLabel(optimisticEnv)} environment.`,
      );
    } finally {
      setIsRequestingAccess(false);
    }
  };

  const projectActions =
    project.role === "owner" || project.role === "editor" ? (
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="[&_svg]:size-5">
              <Settings className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {project.role === "owner" && (
              <DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>
                <Edit3 className="w-4 h-4 mr-2" /> Rename
              </DropdownMenuItem>
            )}
            {(project.role === "owner" || project.role === "editor") && (
              <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                <Share2 className="w-4 h-4 mr-2" /> Share
              </DropdownMenuItem>
            )}
            {project.role === "owner" && (
              <DropdownMenuItem onClick={() => setTransferDialogOpen(true)}>
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Transfer Ownership
              </DropdownMenuItem>
            )}
            {project.role === "owner" && (
              <DropdownMenuItem onClick={() => setGithubDialogOpen(true)}>
                <Github className="w-4 h-4 mr-2" /> GitHub Integration
              </DropdownMenuItem>
            )}
            {project.role === "owner" && (
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/project/${project.slug}/audit-logs`)
                }
              >
                <ShieldCheck className="w-4 h-4 mr-2" /> Audit Logs
              </DropdownMenuItem>
            )}
            {project.role === "owner" && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDeleteClick}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={project.name}
        backTo="/dashboard"
        actions={projectActions}
        hideSearch
      />

      <main className="container mx-auto py-8 px-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Variables ({project.variables.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Mode: {project.ui_mode || "simple"} | Environment:{" "}
              {project.active_environment_slug ||
                project.default_environment_slug ||
                "development"}
            </p>
            {isAdvancedMode && availableEnvironments.length > 0 && (
              <div className="mt-3">
                <Tabs
                  value={optimisticEnv}
                  onValueChange={handleEnvironmentChange}
                >
                  <TabsList>
                    {availableEnvironments.map((env, index) => (
                      <TabsTrigger key={env.id} value={env.slug}>
                        {env.name}
                        <Kbd className="ml-2 px-1.5 text-[10px] bg-muted/50 border-0">
                          {index + 1}
                        </Kbd>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-default">
                      <Info className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground select-all">
                        {project.id}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">Project ID</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Used for CLI authentication and API integration.
                      <br />
                      Active environment:{" "}
                      <span className="font-mono">{activeEnvironment}</span>
                      <br />
                      Run{" "}
                      <code className="font-mono bg-muted px-1 rounded">
                        envault pull --project {project.id} --env{" "}
                        {activeEnvironment}
                      </code>
                    </p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(project.id);
                        setIdCopied(true);
                        setTimeout(() => setIdCopied(false), 2000);
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {idCopied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {idCopied ? "Copied!" : "Copy Project ID"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Button
              id="download-env-btn"
              variant="outline"
              onClick={handleDownloadEnv}
              disabled={!hasEnvironmentAccess}
            >
              <Download className="w-4 h-4 mr-2" />
              Download .env
            </Button>
            {canEditEnvironment && (
              <>
                <ImportEnvDialog
                  projectId={projectId}
                  environmentSlug={activeEnvironment}
                  existingVariables={project.variables}
                  open={isImportDialogOpen}
                  onOpenChange={setIsImportDialogOpen}
                  trigger={
                    <Button variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Import .env
                    </Button>
                  }
                />
                <VariableDialog
                  projectId={projectId}
                  environmentSlug={activeEnvironment}
                  existingVariables={project.variables}
                  open={isAddDialogOpen}
                  onOpenChange={setIsAddDialogOpen}
                  trigger={
                    <Button variant="default">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Variable
                      <Kbd variant="primary" size="xs" className="ml-2">
                        N
                      </Kbd>
                    </Button>
                  }
                />
              </>
            )}
          </div>
        </div>

        {isPending ? (
          <div className="mt-8">
            <EnvVarTableSkeleton />
          </div>
        ) : (
          <EnvVarTable
            projectId={projectId}
            environmentSlug={activeEnvironment}
            variables={project.variables}
            userRole={project.role}
            accessDenied={!hasEnvironmentAccess}
            onRequestAccess={handleRequestAccess}
            isRequestingAccess={isRequestingAccess}
          />
        )}
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This
              will permanently delete all environment variables in this project.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label
              htmlFor="project-delete-confirmation"
              className="text-sm font-normal"
            >
              To confirm, type{" "}
              <span className="inline-flex items-center gap-1 font-bold">
                &quot;{project.name}&quot;{" "}
                {projectNameCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy
                    className="h-4 w-4 cursor-pointer hover:text-primary"
                    onClick={handleCopyProjectName}
                  />
                )}
              </span>{" "}
              below:
            </Label>
            <Input
              id="project-delete-confirmation"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={project.name}
              className="bg-background"
            />
            {project.role === "owner" && (
              <p className="text-xs text-muted-foreground">
                Prefer not to delete?{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 text-foreground hover:text-primary transition-colors"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setTransferDialogOpen(true);
                  }}
                >
                  Transfer ownership instead
                </button>
                .
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-shortcut-submit="true"
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmation !== project.name || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
              {!isDeleting && (
                <div className="hidden sm:flex items-center gap-1">
                  <Kbd variant="primary" size="xs">
                    <ModKey />
                  </Kbd>
                  <Kbd variant="primary" size="xs">
                    <CornerDownLeft className="h-3 w-3" />
                  </Kbd>
                </div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareProjectDialog
        project={project}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />

      <RenameProjectDialog
        project={project}
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
      />
      <GitHubIntegrationDialog
        project={project}
        open={githubDialogOpen}
        onOpenChange={setGithubDialogOpen}
      />
      <TransferOwnershipDialog
        project={project}
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
      />
    </div>
  );
}

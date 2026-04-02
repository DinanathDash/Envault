"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Github,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Unlink,
  Lock,
  GitFork,
  Users,
  Search,
  Plus,
  X,
  ExternalLink,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Project } from "@/lib/stores/store";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

interface GitHubInstallation {
  id: number;
  installation_id: number;
  account_login: string | null;
  account_type: string | null;
  created_at: string;
}

interface Repo {
  id: number;
  full_name: string;
  private: boolean;
  fork: boolean;
  pushed_at?: string;
  owner_login?: string;
}

interface GitHubIntegrationDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RepoSkeletons() {
  return (
    <div className="divide-y">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 p-3">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <Skeleton className="h-3.5 w-44" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md shrink-0" />
        </div>
      ))}
    </div>
  );
}

function AccountSkeletons() {
  return (
    <div className="flex gap-2">
      <Skeleton className="h-8 w-28 rounded-full" />
      <Skeleton className="h-8 w-24 rounded-full" />
    </div>
  );
}

// Pre-flight sheet removed because we now use GitHub's native OAuth account picker
// through the /api/github/add-account route.

export function GitHubIntegrationDialog({
  project,
  open,
  onOpenChange,
}: GitHubIntegrationDialogProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isLinking, setIsLinking] = useState(false);
  const [linkingRepoFullName, setLinkingRepoFullName] = useState<string | null>(
    null,
  );
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [isFetchingInstallations, setIsFetchingInstallations] = useState(false);

  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [selectedInstallationId, setSelectedInstallationId] = useState<
    number | null
  >(null);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Repo[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [liveProject, setLiveProject] = useState<Project>(project);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLiveProject(project);
  }, [project]);

  const fetchInstallations = useCallback(async () => {
    setIsFetchingInstallations(true);
    try {
      const { data, error } = await supabase
        .from("github_installations")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as GitHubInstallation[];
      setInstallations(rows);

      if (rows.length > 0 && selectedInstallationId === null) {
        setSelectedInstallationId(rows[0].installation_id);
      }
    } catch {
      toast.error("Failed to load GitHub accounts");
    } finally {
      setIsFetchingInstallations(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;

    supabase
      .from("projects")
      .select("*")
      .eq("id", project.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setLiveProject(data as Project);
      });

    fetchInstallations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchRepositories = useCallback(async (installationId: number) => {
    setIsFetchingRepos(true);
    setRepos([]);
    setSearchQuery("");
    setSearchResults(null);
    try {
      const res = await fetch(
        `/api/github/repositories?installation_id=${installationId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch repositories");
      const data = (await res.json()) as { repositories?: Repo[] };
      setRepos(data.repositories ?? []);
    } catch {
      toast.error("Failed to load GitHub repositories");
    } finally {
      setIsFetchingRepos(false);
    }
  }, []);

  useEffect(() => {
    if (open && selectedInstallationId !== null) {
      fetchRepositories(selectedInstallationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedInstallationId]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      if (!selectedInstallationId) return;
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/github/repositories/search?installation_id=${selectedInstallationId}&q=${encodeURIComponent(value.trim())}`,
        );
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as { repositories?: Repo[] };
        setSearchResults(data.repositories ?? []);
      } catch {
        toast.error("Search failed");
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const launchGitHub = () => {
    // Open our new OAuth proxy route which redirects to GitHub's account picker
    window.open(
      `/api/github/add-account?project_id=${liveProject.id}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleSelectRepo = async (repoFullName: string) => {
    setIsLinking(true);
    setLinkingRepoFullName(repoFullName);
    try {
      const { data: conflict } = await supabase
        .from("projects")
        .select("id, name")
        .eq("github_repo_full_name", repoFullName)
        .neq("id", liveProject.id)
        .limit(1)
        .single();

      if (conflict) {
        toast.error(
          `"${repoFullName}" is already linked to "${conflict.name}". Each repository can only be linked to one project.`,
        );
        return;
      }

      const { error } = await supabase
        .from("projects")
        .update({ github_repo_full_name: repoFullName })
        .eq("id", liveProject.id);

      if (error) throw error;

      // Audit: repo linked (client-side fire-and-forget via API)
      fetch("/api/audit/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "github.repo_linked",
          projectId: liveProject.id,
          metadata: { repo_full_name: repoFullName },
        }),
      }).catch(() => {});

      setLiveProject((p) => ({ ...p, github_repo_full_name: repoFullName }));
      toast.success("Repository linked!");
      router.refresh();
    } catch {
      toast.error("Failed to link repository");
    } finally {
      setIsLinking(false);
      setLinkingRepoFullName(null);
    }
  };

  const handleUnlink = async () => {
    const prevRepo = liveProject.github_repo_full_name;
    setIsLinking(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ github_repo_full_name: null })
        .eq("id", liveProject.id);

      if (error) throw error;

      // Audit: repo unlinked
      fetch("/api/audit/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "github.repo_unlinked",
          projectId: liveProject.id,
          metadata: { repo_full_name: prevRepo, reason: "manual" },
        }),
      }).catch(() => {});

      setLiveProject((p) => ({ ...p, github_repo_full_name: null }));
      toast.success("Repository unlinked");
      router.refresh();
      if (selectedInstallationId) fetchRepositories(selectedInstallationId);
    } catch {
      toast.error("Failed to unlink repository");
    } finally {
      setIsLinking(false);
    }
  };

  const selectedInstallation = installations.find(
    (i) => i.installation_id === selectedInstallationId,
  );

  const displayedRepos = searchQuery.trim() ? (searchResults ?? []) : repos;
  const hasSelectedRepo = !!liveProject.github_repo_full_name;
  const hasInstallations = installations.length > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-md sm:w-full flex flex-col max-h-[90dvh] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              GitHub Integration
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Link a repository from your GitHub account. Once linked,
              collaborators on that repository who run{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                envault pull
              </code>{" "}
              are automatically granted read access - Envault verifies their
              GitHub identity automatically.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4 space-y-4">
            {/* No GitHub App connected */}
            {!hasInstallations && !isFetchingInstallations && (
              <div className="flex flex-col items-center justify-center space-y-4 text-center p-6 border rounded-lg bg-muted/30">
                <div className="bg-background p-3 rounded-full shadow-sm border">
                  <Github className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">No GitHub account connected</h4>
                  <p className="text-sm text-muted-foreground">
                    Install the Envault GitHub App on your personal account or
                    organisation to get started.
                  </p>
                </div>
                <Button onClick={launchGitHub} className="w-full sm:w-auto">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Connect GitHub Account
                </Button>
              </div>
            )}

            {/* Accounts loading */}
            {isFetchingInstallations && !hasInstallations && (
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <AccountSkeletons />
              </div>
            )}

            {/* Account switcher + repo UI */}
            {hasInstallations && (
              <>
                {/* Account selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      GitHub Account
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={launchGitHub}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add account
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="left"
                        className="max-w-[220px] text-center"
                      >
                        Opens GitHub in a new tab. Make sure you are signed into
                        the correct account first.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {installations.map((inst) => (
                      <button
                        key={inst.installation_id}
                        onClick={() =>
                          setSelectedInstallationId(inst.installation_id)
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          selectedInstallationId === inst.installation_id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        <Github className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[120px]">
                          {inst.account_login ??
                            `Installation ${inst.installation_id}`}
                        </span>
                        {inst.account_type === "Organization" && (
                          <Building2 className="h-3 w-3 shrink-0 opacity-70" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Linked repo status */}
                {hasSelectedRepo && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          Linked Repository
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-400 font-mono mt-0.5 truncate">
                          {liveProject.github_repo_full_name}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnlink}
                      disabled={isLinking}
                      className="shrink-0 w-full sm:w-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {isLinking ? (
                        <Skeleton className="h-4 w-16" />
                      ) : (
                        <>
                          <Unlink className="h-4 w-4 mr-2" />
                          Unlink
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Prompt to pick a repo, Search bar and Repo list (only visible if NO repo is linked) */}
                {!hasSelectedRepo && (
                  <>
                    <div className="flex items-start gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md border border-amber-200 dark:border-amber-900">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p className="text-sm">
                        Select a repository below to link it to this project.
                      </p>
                    </div>

                    {/* Search bar - stopPropagation prevents 'v' hotkey from firing */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      {searchQuery && (
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setSearchQuery("");
                            setSearchResults(null);
                          }}
                          aria-label="Clear search"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <Input
                        placeholder="Search repositories..."
                        className="pl-9 pr-8"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        // Prevent global hotkeys (e.g. 'v' = toggle value visibility)
                        // from intercepting keystrokes inside this input.
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Repository list */}
                    <div className="border rounded-md overflow-hidden">
                      {isFetchingRepos || isSearching ? (
                        <RepoSkeletons />
                      ) : displayedRepos.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                          {searchQuery.trim()
                            ? `No repositories found for "${searchQuery}".`
                            : "No repositories found. Make sure you granted access during installation."}
                        </div>
                      ) : (
                        <div className="max-h-[240px] overflow-y-auto overflow-x-hidden divide-y">
                          {displayedRepos.map((repo) => {
                            const isCollaborator =
                              selectedInstallation?.account_login &&
                              repo.owner_login &&
                              repo.owner_login.toLowerCase() !==
                                selectedInstallation.account_login.toLowerCase();

                            return (
                              <div
                                key={repo.id}
                                className="flex items-center justify-between gap-2 p-3 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm font-medium truncate">
                                      {repo.full_name}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {repo.private && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Lock
                                              className="h-3.5 w-3.5 text-amber-500 cursor-default"
                                              aria-label="Private Repository"
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Private Repository
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                      {repo.fork && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <GitFork
                                              className="h-3.5 w-3.5 text-blue-500 cursor-default"
                                              aria-label="Forked Repository"
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Forked Repository
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                      {isCollaborator && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Users
                                              className="h-3.5 w-3.5 text-purple-500 cursor-default"
                                              aria-label="You are a collaborator"
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            You are a collaborator
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </div>
                                  {repo.pushed_at && (
                                    <span className="text-xs text-muted-foreground">
                                      last commit{" "}
                                      {formatRelativeTime(repo.pushed_at)}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant={"secondary"}
                                  className="shrink-0"
                                  onClick={() =>
                                    handleSelectRepo(repo.full_name)
                                  }
                                  disabled={isLinking}
                                >
                                  {isLinking &&
                                  linkingRepoFullName === repo.full_name
                                    ? "Linking..."
                                    : "Select"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Contextual footer info */}
                {hasSelectedRepo && (
                  <p className="text-sm text-muted-foreground">
                    GitHub collaborators on{" "}
                    <strong className="break-all font-mono text-xs">
                      {liveProject.github_repo_full_name}
                    </strong>{" "}
                    can run{" "}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                      envault pull
                    </code>{" "}
                    to instantly receive read access - Envault verifies their
                    GitHub identity automatically.
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

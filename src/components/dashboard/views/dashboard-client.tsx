"use client";

import { useEnvaultStore, Project } from "@/lib/stores/store";
import { CreateProjectDialog } from "@/components/dialogs/create-project-dialog";
import { ProjectCard } from "@/components/dashboard/ui/project-card";
import { ShieldCheck, Share2 } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function DashboardClient({
  initialProjects,
}: {
  initialProjects: Project[];
}) {
  const [projectsToUse, setProjectsToUse] =
    useState<Project[]>(initialProjects);
  const projects = useEnvaultStore((state) => state.projects);
  const { user } = useEnvaultStore();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get("tab") || "my-projects",
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const requested = searchParams.get("requested");
  const approved = searchParams.get("approved");
  const denied = searchParams.get("denied");

  // Keep internal client store in sync. While the dashboard could just use initialProjects,
  // we want to ensure client-side changes (like deletion) are reflected without hard reloads
  useEffect(() => {
    // If we have projects in store, we use them, otherwise use initialProjects
    if (projects.length > 0) {
      setProjectsToUse(projects);
    } else {
      useEnvaultStore.getState().setProjects(initialProjects as Project[]);
      setProjectsToUse(initialProjects);
    }
  }, [initialProjects, projects]);

  const refreshProjects = useCallback(async () => {
    const { getProjects } = await import("@/app/project-actions");
    const result = await getProjects(true); // bypass cache
    if (result.data) {
      const setProjects = useEnvaultStore.getState().setProjects;
      setProjects(result.data as Project[]);
      setProjectsToUse(result.data as Project[]);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (requested === "true") {
      toast.success("Access request sent!", {
        description: "The project owner will be notified of your request.",
        duration: 5000,
      });
    } else if (approved === "true") {
      toast.success("Access request approved!", {
        description: "The user has been added to the project.",
        duration: 5000,
      });
      refreshProjects();
    } else if (denied === "true") {
      toast.info("Access request denied.", {
        description: "The request has been removed.",
        duration: 5000,
      });
    }

    if (requested || approved || denied) {
      const url = new URL(window.location.href);
      url.searchParams.delete("requested");
      url.searchParams.delete("approved");
      url.searchParams.delete("denied");
      router.replace(url.pathname + url.search);
    }

    const handleProjectRoleChanged = () => {
      refreshProjects();
    };

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceTimer: NodeJS.Timeout;
    let isStale = false; // Tracks if DB changed while we were hidden

    const handleRealtimeEvent = () => {
      if (document.visibilityState === "visible") {
        refreshProjects();
      } else {
        isStale = true; // Mark as stale, fetch when we return
      }
    };

    const connectRealtime = () => {
      if (channel) return;
      channel = supabase
        .channel("dashboard-sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "projects" },
          handleRealtimeEvent,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "project_members" },
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
          refreshProjects();
          isStale = false;
        }
      }, 300);
    };

    connectRealtime();

    document.addEventListener("project-role-changed", handleProjectRoleChanged);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearTimeout(debounceTimer);
      document.removeEventListener(
        "project-role-changed",
        handleProjectRoleChanged,
      );
      window.removeEventListener("focus", handleFocus);
      disconnectRealtime();
    };
  }, [requested, approved, denied, router, refreshProjects]);

  useEffect(() => {
    if (!mounted) return;
    const currentUrlTab = searchParams.get("tab");
    const defaultTab = "my-projects";
    if (activeTab === defaultTab && !currentUrlTab) return;
    if (activeTab !== currentUrlTab) {
      const params = new URLSearchParams(searchParams.toString());
      if (activeTab === defaultTab) {
        params.delete("tab");
      } else {
        params.set("tab", activeTab);
      }
      const query = params.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      window.history.replaceState(null, "", url);
    }
  }, [activeTab, mounted, pathname, searchParams]);

  useEffect(() => {
    const handleNew = () => setIsCreateDialogOpen(true);
    const handleSwitch = (e: Event) => {
      const index = (e as CustomEvent).detail.index;
      if (index === 0) setActiveTab("my-projects");
      if (index === 1) setActiveTab("shared-with-me");
    };

    document.addEventListener("universal-new", handleNew);
    document.addEventListener("switch-tab", handleSwitch);

    return () => {
      document.removeEventListener("universal-new", handleNew);
      document.removeEventListener("switch-tab", handleSwitch);
    };
  }, []);

  const myProjects = projectsToUse.filter(
    (p) => p.role === "owner" || p.role === "editor",
  );
  const sharedProjects = projectsToUse.filter(
    (p) => p.role === "viewer" && p.user_id !== user?.id,
  );

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">Projects</h1>
          <p className="text-muted-foreground">
            Manage your environment variables securely.
          </p>
        </div>
        <CreateProjectDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="my-projects" className="flex items-center gap-2">
            My Projects<Kbd size="xs">1</Kbd>
          </TabsTrigger>
          <TabsTrigger
            value="shared-with-me"
            className="flex items-center gap-2"
          >
            Shared with Me<Kbd size="xs">2</Kbd>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-projects">
          {!mounted ? (
            <ProjectSkeletonGrid />
          ) : myProjects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
              {myProjects.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shared-with-me">
          {!mounted ? (
            <ProjectSkeletonGrid />
          ) : sharedProjects.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-xl">
              <Share2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No shared projects</h3>
              <p className="text-muted-foreground mb-4">
                You haven&apos;t been invited to any projects yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
              {sharedProjects.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

export function ProjectSkeletonGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-xl border bg-card text-card-foreground shadow h-full min-h-[12rem] relative overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
          <div className="absolute bottom-0 w-full bg-muted/20 border-t p-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="h-12" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 border-2 border-dashed rounded-xl">
      <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium">No projects yet</h3>
      <p className="text-muted-foreground mb-4">
        Create your first project to get started.
      </p>
      <div className="inline-block">
        <CreateProjectDialog />
      </div>
    </div>
  );
}

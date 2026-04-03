"use client";

import { Link } from "next-view-transitions";
import { DateDisplay } from "@/components/ui/date-display";
import {
  Folder,
  MoreVertical,
  Trash2,
  CornerDownLeft,
  Command,
  Users,
  Copy,
  Check,
  Pencil,
  Loader2,
} from "lucide-react";
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Project, useEnvaultStore } from "@/lib/stores/store";
import { toast } from "sonner";
import { deleteProject as deleteProjectAction } from "@/app/project-actions";
import { triggerHaptic } from "@/lib/utils/haptic";

import { ShareProjectDialog } from "@/components/dialogs/share-project-dialog";
import { RenameProjectDialog } from "@/components/dialogs/rename-project-dialog";
import { TransferOwnershipDialog } from "@/components/dialogs/transfer-ownership-dialog";
import { Share2 } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";

interface ProjectCardProps {
  project: Project;
}

const ModKey = () => (
  <>
    <Command className="w-3 h-3 mac-only" />
    <span className="non-mac-only">Ctrl</span>
  </>
);

export function ProjectCard({ project }: ProjectCardProps) {
  const deleteProject = useEnvaultStore((state) => state.deleteProject);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const router = useRouter();

  const handleDeleteClick = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDeleteConfirmation("");
    setIsDeleting(false);
    setDeleteDialogOpen(true);
  };

  // Listen for contextual shortcuts
  React.useEffect(() => {
    const handleUniversalShare = () => {
      if (project.role === "viewer") return;
      // If this card is focused or has a focused element within it
      if (
        document.activeElement?.closest(`a[href="/project/${project.slug}"]`)
      ) {
        setShareDialogOpen(true);
      }
    };
    const handleUniversalDelete = () => {
      if (project.role !== "owner") return;
      if (
        document.activeElement?.closest(`a[href="/project/${project.slug}"]`)
      ) {
        handleDeleteClick();
      }
    };

    document.addEventListener("universal-share", handleUniversalShare);
    document.addEventListener("universal-delete", handleUniversalDelete);
    return () => {
      document.removeEventListener("universal-share", handleUniversalShare);
      document.removeEventListener("universal-delete", handleUniversalDelete);
    };
  }, [project.id, project.role, project.slug]);

  const handleDeleteConfirm = async (
    e?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (e) {
      e.preventDefault();
    }
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
    router.refresh();
  };

  const [projectNameCopied, setProjectNameCopied] = React.useState(false);

  const handleCopyProjectName = async () => {
    try {
      await navigator.clipboard.writeText(project.name);
      setProjectNameCopied(true);
      setTimeout(() => setProjectNameCopied(false), 2000);
    } catch {
      toast.error("Failed to copy project name");
    }
  };

  return (
    <>
      <Link
        href={
          project.isShared && project.owner_username && project.role !== "owner"
            ? `/${project.owner_username}/${project.slug}`
            : `/project/${project.slug}`
        }
        className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl transition-all"
      >
        <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md group relative overflow-hidden">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Folder className="w-5 h-5 text-primary" />
                </div>
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <CardTitle className="line-clamp-1">{project.name}</CardTitle>
                  {project.isShared && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex-shrink-0">
                          <Users className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This project is shared with others</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              <div
                className="flex items-center"
                onClick={(e) => e.preventDefault()}
              >
                {(project.role === "owner" || project.role === "editor") && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mr-2 text-muted-foreground"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {project.role === "owner" && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameDialogOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                      )}

                      {/* Editors can share (initiates an approval request to the owner) */}
                      {(project.role === "owner" ||
                        project.role === "editor") && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareDialogOpen(true);
                          }}
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                      )}

                      {project.role === "owner" && (
                        <DropdownMenuItem
                          className="text-red-600 dark:text-red-500 focus:text-red-600 dark:focus:text-red-500"
                          onClick={handleDeleteClick}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardHeader>
          <CardFooter className="absolute bottom-0 w-full bg-muted/20 border-t p-3">
            <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
              <span>{project.secretCount ?? 0} variables</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help text-xs text-muted-foreground">
                      {project.createdAt
                        ? (() => {
                            const date = new Date(project.createdAt);
                            return isNaN(date.getTime()) ? (
                              "Invalid date"
                            ) : (
                              <DateDisplay
                                date={date}
                                addSuffix
                                formatType="relative"
                              />
                            );
                          })()
                        : "No date"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {project.createdAt ? (
                        <DateDisplay
                          date={project.createdAt}
                          formatType="absolute"
                        />
                      ) : (
                        "No date"
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardFooter>
          <div className="h-12" /> {/* Spacer for footer */}
        </Card>
      </Link>

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
      <TransferOwnershipDialog
        project={project}
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
      />
    </>
  );
}

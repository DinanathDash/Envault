"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Loader2,
  Edit3,
  AlertTriangle,
  CornerDownLeft,
  Command,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Kbd } from "@/components/ui/kbd";
import { Project } from "@/lib/stores/store";
import { renameProject } from "@/app/project-actions";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { replaceWithTransition } from "@/lib/utils/view-transition-navigation";

const ModKey = () => (
  <>
    <Command className="w-3 h-3 mac-only" />
    <span className="non-mac-only">Ctrl</span>
  </>
);

const renameSchema = z.object({
  name: z.string().min(1, "Project name is required"),
});

type RenameValues = z.infer<typeof renameSchema>;

interface RenameProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameProjectDialog({
  project,
  open,
  onOpenChange,
}: RenameProjectDialogProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RenameValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: {
      name: project.name,
    },
  });

  const [expectedSlug, setExpectedSlug] = React.useState(project.slug);
  const watchName = useWatch({ control, name: "name" }) || "";

  React.useEffect(() => {
    if (watchName) {
      setExpectedSlug(
        watchName
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "") || "project",
      );
    }
  }, [watchName]);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      reset({ name: project.name });
    }
  }, [open, project.name, reset]);

  useHotkeys(
    "mod+enter",
    () => {
      if (
        open &&
        !(isSubmitting || watchName === project.name || !watchName.trim())
      ) {
        handleSubmit(onSubmit)();
      }
    },
    { enableOnFormTags: true, enableOnContentEditable: true },
  );

  async function onSubmit(data: RenameValues) {
    if (data.name === project.name) {
      onOpenChange(false);
      return;
    }

    const result = await renameProject(project.id, data.name);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    // Attempt to update local store directly for instantaneous feedback before the server round-trip completes
    const { useEnvaultStore } = await import("@/lib/stores/store");
    const setProjects = useEnvaultStore.getState().setProjects;
    const currentProjects = useEnvaultStore.getState().projects;

    // Only update if it exists in the store to be safe
    if (result.data) {
      const updatedStore = currentProjects.map((p) =>
        p.id === project.id
          ? { ...p, name: result.data.name, slug: result.data.slug }
          : p,
      );
      setProjects(updatedStore);
    }

    toast.success("Project renamed successfully");
    onOpenChange(false);

    // Redirect to the new slug immediately.
    // Uses `replace` since it's the exact same project ID logically.
    if (result.data?.slug && result.data.slug !== project.slug) {
      replaceWithTransition(router, `/project/${result.data.slug}`);
    } else {
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg sm:w-full">
        <DialogHeader>
          <DialogTitle>Rename Project</DialogTitle>
          <DialogDescription>
            Change the name of your environment variable container.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-md p-4 mb-2 flex gap-3 text-sm text-yellow-800 dark:text-yellow-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            <strong>Warning:</strong> Renaming this project will change its URL
            slug. If you have bookmarked this page or shared the direct link,
            those old links will break. However, the Project UUID used for API
            access will remain the same.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-name">Project Name</Label>
            <Input
              id="rename-name"
              placeholder="My Awesome App"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              New Route Slug
            </Label>
            <div className="flex px-3 py-2 bg-muted rounded-md text-sm border font-mono">
              <span className="text-muted-foreground shrink-0 select-none">
                /project/
              </span>
              <span className="truncate">{expectedSlug}</span>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || watchName === project.name || !watchName.trim()
              }
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Edit3 className="h-4 w-4" />
              )}
              Rename Project
              <div className="flex items-center gap-1 opacity-70 ml-1 hidden sm:flex">
                <Kbd variant="primary" size="xs">
                  <ModKey />
                </Kbd>
                <Kbd variant="primary" size="xs">
                  <CornerDownLeft className="h-3 w-3" />
                </Kbd>
              </div>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

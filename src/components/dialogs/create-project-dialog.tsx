"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, CornerDownLeft, Command } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject } from "@/app/project-actions";
import { Kbd } from "@/components/ui/kbd";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  uiMode: z.enum(["simple", "advanced"]),
  defaultEnvironmentSlug: z.enum(["development", "preview", "production"]),
});

type ProjectValues = z.infer<typeof projectSchema>;

interface CreateProjectDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateProjectDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateProjectDialogProps = {}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [uiMode, setUiMode] = React.useState<ProjectValues["uiMode"]>("simple");
  const [defaultEnvironmentSlug, setDefaultEnvironmentSlug] =
    React.useState<ProjectValues["defaultEnvironmentSlug"]>("development");
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      uiMode: "simple",
      defaultEnvironmentSlug: "development",
    },
  });

  async function onSubmit(data: ProjectValues) {
    const result = await createProject(data.name, {
      uiMode: data.uiMode,
      defaultEnvironmentSlug: data.defaultEnvironmentSlug,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Project created successfully");
    setOpen(false);
    reset({
      name: "",
      uiMode: "simple",
      defaultEnvironmentSlug: "development",
    });
    setUiMode("simple");
    setDefaultEnvironmentSlug("development");
    router.push(`/project/${result.data?.slug}`);
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      reset({
        name: "",
        uiMode: "simple",
        defaultEnvironmentSlug: "development",
      });
      setUiMode("simple");
      setDefaultEnvironmentSlug("development");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Project
          <Kbd className="ml-2 h-5 px-1.5 text-[10px] bg-primary-foreground/20 text-primary-foreground border-0">
            N
          </Kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-lg sm:w-full">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Create a new container for your environment variables.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              placeholder="My Awesome App"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ui-mode">Workspace Mode</Label>
            <Select
              value={uiMode}
              onValueChange={(value) => {
                const next = value as ProjectValues["uiMode"];
                setUiMode(next);
                setValue("uiMode", next, { shouldValidate: true });
              }}
            >
              <SelectTrigger id="ui-mode">
                <SelectValue placeholder="Choose mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">
                  Simple (single environment view)
                </SelectItem>
                <SelectItem value="advanced">
                  Advanced (multi-environment ready)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-environment">Default Environment</Label>
            <Select
              value={defaultEnvironmentSlug}
              onValueChange={(value) => {
                const next = value as ProjectValues["defaultEnvironmentSlug"];
                setDefaultEnvironmentSlug(next);
                setValue("defaultEnvironmentSlug", next, {
                  shouldValidate: true,
                });
              }}
            >
              <SelectTrigger id="default-environment">
                <SelectValue placeholder="Choose default environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="preview">Preview</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Project
              <div className="ml-2 flex items-center gap-1">
                <Kbd className="bg-white/20 text-white border-0">
                  <Command className="w-3 h-3" />
                </Kbd>
                <Kbd className="bg-white/20 text-white border-0">
                  <CornerDownLeft className="w-3 h-3" />
                </Kbd>
              </div>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

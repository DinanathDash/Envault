"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Loader2,
  CheckCircle2,
  Info,
  AlertCircle,
  Eye,
  EyeOff,
  CornerDownLeft,
} from "lucide-react";
import { Kbd } from "@/components/ui/kbd";

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
import { EnvironmentVariable } from "@/lib/stores/store";
import { toast } from "sonner";
import {
  addVariable as addVariableAction,
  updateVariable as updateVariableAction,
} from "@/app/project-actions";
import { useRouter } from "next/navigation";

import { useHotkeys } from "@/hooks/use-hotkeys";
import { getModifierKey } from "@/lib/utils/utils";
import { MaskedDots } from "@/components/ui/masked-dots";

const variableSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric characters and underscores"),
  value: z.string().min(1, "Value is required"),
});

type VariableValues = z.infer<typeof variableSchema>;

interface VariableDialogProps {
  projectId: string;
  environmentSlug?: string;
  existingVariable?: EnvironmentVariable;
  existingVariables?: EnvironmentVariable[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function VariableDialog({
  projectId,
  environmentSlug,
  existingVariable,
  existingVariables = [],
  trigger,
  open: controlledOpen,
  onOpenChange,
}: VariableDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VariableValues>({
    resolver: zodResolver(variableSchema),
    defaultValues: {
      key: existingVariable?.key || "",
      value: existingVariable?.value || "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const key = watch("key");
  const value = watch("value");

  const status = React.useMemo(() => {
    if (existingVariable || !key) return null;

    const collision = existingVariables?.find((v) => v.key === key);
    if (!collision) return { type: "new", message: "New Variable" };

    if (collision.value === value) {
      return { type: "skip", message: "Variable exists with same value" };
    }

    return { type: "update", message: "Variable exists (Will Update)" };
  }, [key, value, existingVariable, existingVariables]);

  // Update form if existingVariable changes
  React.useEffect(() => {
    if (existingVariable) {
      setValue("key", existingVariable.key);
      setValue("value", existingVariable.value);
    } else {
      reset({ key: "", value: "" });
    }
  }, [existingVariable, setValue, reset]);

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) {
      reset({ key: "", value: "" });
    }
  }, [open, reset]);

  async function onSubmit(data: VariableValues) {
    if (existingVariable) {
      const result = await updateVariableAction(
        existingVariable.id,
        projectId,
        {
          key: data.key,
          value: data.value,
        },
        environmentSlug,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Variable updated");
    } else {
      const collision = existingVariables?.find((v) => v.key === data.key);

      if (collision) {
        // Upsert/Update existing
        const result = await updateVariableAction(
          collision.id,
          projectId,
          {
            key: data.key,
            value: data.value,
          },
          environmentSlug,
        );
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Variable updated");
      } else {
        // Create new
        const result = await addVariableAction(
          projectId,
          data.key,
          data.value,
          environmentSlug,
        );
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Variable created");
      }
    }
    setOpen(false);
    if (!existingVariable) reset();
    router.refresh();
  }

  useHotkeys(
    "v",
    () => {
      if (open) setShowPassword((prev) => !prev);
    },
    { enableOnContentEditable: false, enableOnFormTags: false },
  );

  const modKey = getModifierKey("mod");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[95vw] max-w-lg sm:w-full">
        <DialogHeader>
          <DialogTitle>
            {existingVariable ? "Edit Variable" : "Add Variable"}
          </DialogTitle>
          <DialogDescription>
            {existingVariable
              ? "Update the variable details."
              : "Add a new environment variable to this project."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              placeholder="DATABASE_URL"
              {...register("key")}
              className="font-mono uppercase"
              onChange={(e) => {
                const val = e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9_]/g, "");
                setValue("key", val);
              }}
            />
            {errors.key && (
              <p className="text-xs text-destructive">{errors.key.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <div className="relative">
              <Input
                id="value"
                placeholder="postgres://..."
                type="text"
                {...register("value")}
                className={`font-mono pr-10 ${!showPassword && value ? "text-transparent" : ""}`}
              />
              {!showPassword && !!value && (
                <div className="absolute inset-y-0 left-3 right-12 flex items-center pointer-events-none">
                  <MaskedDots
                    count={Math.max(8, Math.min(24, value.length))}
                    className="max-w-full overflow-hidden"
                  />
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-10"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPassword((prev) => !prev);
                }}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <Kbd variant="ghost" size="xs" className="ml-1">
                  V
                </Kbd>
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
            {errors.value && (
              <p className="text-xs text-destructive">{errors.value.message}</p>
            )}
          </div>

          {status && (
            <div
              className={`flex items-center gap-2 p-2 rounded-md text-sm font-medium ${
                status.type === "new"
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : status.type === "update"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
              }`}
            >
              {status.type === "new" && <CheckCircle2 className="w-4 h-4" />}
              {status.type === "update" && <Info className="w-4 h-4" />}
              {status.type === "skip" && <AlertCircle className="w-4 h-4" />}
              <span>{status.message}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={isSubmitting || status?.type === "skip"}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {existingVariable ? (
                <span className="flex items-center gap-2">
                  Save Changes{" "}
                  <span className="hidden md:flex items-center gap-1">
                    <Kbd variant="primary" size="xs">
                      {modKey}
                    </Kbd>
                    <Kbd variant="primary" size="xs">
                      <CornerDownLeft className="w-3 h-3" />
                    </Kbd>
                  </span>
                </span>
              ) : status?.type === "update" ? (
                <span className="flex items-center gap-2">
                  Update Variable{" "}
                  <span className="hidden md:flex items-center gap-1">
                    <Kbd variant="primary" size="xs">
                      {modKey}
                    </Kbd>
                    <Kbd variant="primary" size="xs">
                      <CornerDownLeft className="w-3 h-3" />
                    </Kbd>
                  </span>
                </span>
              ) : status?.type === "skip" ? (
                "No Changes"
              ) : (
                <span className="flex items-center gap-2">
                  Add Variable{" "}
                  <span className="hidden md:flex items-center gap-1">
                    <Kbd variant="primary" size="xs">
                      {modKey}
                    </Kbd>
                    <Kbd variant="primary" size="xs">
                      <CornerDownLeft className="w-3 h-3" />
                    </Kbd>
                  </span>
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

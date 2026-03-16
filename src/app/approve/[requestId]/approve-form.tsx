"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { approveRequest, rejectRequest } from "@/app/invite-actions";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface ApproveFormProps {
  requestId: string;
  environments?: string[];
  requestedEnvironment?: string;
  existingRole?: "viewer" | "editor";
  existingAllowedEnvironments?: string[] | null;
}

export function ApproveForm({
  requestId,
  environments = [],
  requestedEnvironment,
  existingRole = "viewer",
  existingAllowedEnvironments,
}: ApproveFormProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = React.useState(false);
  const [isDenying, setIsDenying] = React.useState(false);
  const [role, setRole] = React.useState<"viewer" | "editor">(existingRole);

  const getInitialSelectedEnvironments = React.useCallback(() => {
    if (environments.length === 0) return [];
    const base =
      existingAllowedEnvironments === null
        ? environments
        : existingAllowedEnvironments || [];
    const merged = requestedEnvironment
      ? Array.from(new Set([...base, requestedEnvironment]))
      : base;
    return merged.filter((env) => environments.includes(env));
  }, [environments, existingAllowedEnvironments, requestedEnvironment]);

  const [selectedEnvironments, setSelectedEnvironments] = React.useState<
    string[]
  >(() => getInitialSelectedEnvironments());

  React.useEffect(() => {
    setRole(existingRole);
    setSelectedEnvironments(getInitialSelectedEnvironments());
  }, [existingRole, getInitialSelectedEnvironments]);

  const handleApprove = async () => {
    if (environments.length > 0 && selectedEnvironments.length === 0) {
      toast.error("Select at least one environment before approving access.");
      return;
    }

    const environmentPayload =
      environments.length > 0 ? selectedEnvironments : undefined;

    setIsApproving(true);
    const result = await approveRequest(
      requestId,
      role,
      true,
      environmentPayload,
    );
    if (result.error) {
      toast.error(result.error);
      setIsApproving(false);
      return;
    }
    router.push("/dashboard?approved=true");
  };

  const handleDeny = async () => {
    setIsDenying(true);
    await rejectRequest(requestId);
    router.push("/dashboard?denied=true");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Assign Role</label>
        <Select
          value={role}
          onValueChange={(v) => setRole(v as "viewer" | "editor")}
        >
          <SelectTrigger className="w-full h-11">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
          </SelectContent>
        </Select>

        {environments.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-medium">Environment Access</label>
            <div className="flex flex-row flex-wrap gap-4 items-center rounded-md border border-input bg-background px-3 py-3 text-sm">
              {environments.map((env) => {
                const isChecked = selectedEnvironments.includes(env);
                return (
                  <div
                    key={`approve-${requestId}-${env}`}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`approve-${requestId}-${env}`}
                      className="rounded border-1"
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        let nextEnvs;
                        if (checked) {
                          nextEnvs = [...selectedEnvironments, env];
                        } else {
                          nextEnvs = selectedEnvironments.filter(
                            (e) => e !== env,
                          );
                        }
                        setSelectedEnvironments(nextEnvs);
                      }}
                    />
                    <label
                      htmlFor={`approve-${requestId}-${env}`}
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

        <Button
          className="w-full h-11 text-base mt-2"
          onClick={handleApprove}
          disabled={isApproving || isDenying}
        >
          {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isApproving ? "Approving..." : "Approve Access"}
        </Button>
      </div>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">OR</span>
        </div>
      </div>

      <Button
        type="button"
        variant="destructive"
        className="w-full h-11 text-base"
        onClick={handleDeny}
        disabled={isApproving || isDenying}
      >
        {isDenying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isDenying ? "Denying..." : "Deny Request"}
      </Button>
    </div>
  );
}

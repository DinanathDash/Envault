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
import { Loader2, Check, X, ArrowRight } from "lucide-react";

export interface PendingChange {
  userId: string;
  type: "approve" | "deny" | "role_change" | "revoke";
  currentRole?: "owner" | "viewer" | "editor" | "pending";
  newRole?: "viewer" | "editor";
  email?: string;
  avatar?: string;
  requestId?: string;
  allowedEnvironments?: string[];
}

interface ShareConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: PendingChange[];
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export function ShareConfirmationDialog({
  open,
  onOpenChange,
  changes,
  onConfirm,
  loading = false,
}: ShareConfirmationDialogProps) {
  const approvals = changes.filter((c) => c.type === "approve");
  const denials = changes.filter((c) => c.type === "deny");
  const roleChanges = changes.filter((c) => c.type === "role_change");
  const revocations = changes.filter((c) => c.type === "revoke");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg sm:text-xl">
            Confirm Changes
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Review and confirm the following changes to project access:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {/* Approvals */}
          {approvals.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600 shrink-0" />
                Approve Access ({approvals.length})
              </h4>
              <div className="space-y-1 pl-6">
                {approvals.map((change) => (
                  <p
                    key={change.userId}
                    className="text-sm text-muted-foreground truncate"
                  >
                    <span className="truncate">{change.email || "User"}</span>{" "}
                    as{" "}
                    <span className="font-medium capitalize">
                      {change.newRole || "viewer"}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Denials */}
          {denials.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <X className="h-4 w-4 text-red-600" />
                Deny Access ({denials.length})
              </h4>
              <div className="space-y-1 pl-6">
                {denials.map((change) => (
                  <p
                    key={change.userId}
                    className="text-sm text-muted-foreground"
                  >
                    {change.email || "User"}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Role Changes */}
          {roleChanges.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-blue-600" />
                Change Roles ({roleChanges.length})
              </h4>
              <div className="space-y-1 pl-6">
                {roleChanges.map((change) => (
                  <p
                    key={change.userId}
                    className="text-sm text-muted-foreground"
                  >
                    {change.email || "User"}:{" "}
                    {change.currentRole !== change.newRole ? (
                      <>
                        <span className="capitalize">{change.currentRole}</span>
                        <ArrowRight
                          className="mx-1 inline-block h-3.5 w-3.5 align-[-1px] text-muted-foreground/80"
                          aria-hidden="true"
                        />
                        <span className="font-medium capitalize">
                          {change.newRole}
                        </span>
                      </>
                    ) : (
                      <span className="font-medium capitalize">
                        {change.currentRole}
                      </span>
                    )}
                    {change.allowedEnvironments !== undefined && (
                      <span className="ml-2 text-xs opacity-70 italic">
                        (env access updated)
                      </span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Revocations */}
          {revocations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <X className="h-4 w-4 text-destructive" />
                Revoke Access ({revocations.length})
              </h4>
              <div className="space-y-1 pl-6">
                {revocations.map((change) => (
                  <p
                    key={change.userId}
                    className="text-sm text-muted-foreground"
                  >
                    {change.email || "User"}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              "Confirm"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

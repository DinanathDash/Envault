"use client";

import * as React from "react";
import {
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Trash2,
  Share2,
  User,
  CornerDownLeft,
  Loader2,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { toast } from "sonner";
import { ShareSecretModal } from "@/components/dashboard/share-secret-modal";
import { DateDisplay } from "@/components/ui/date-display";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { EnvironmentVariable } from "@/lib/store";
import { VariableDialog } from "./variable-dialog";
import { deleteVariable as deleteVariableAction } from "@/app/project-actions";
import { useRouter } from "next/navigation";

interface EnvVarTableProps {
  projectId: string;
  environmentSlug?: string;
  variables: EnvironmentVariable[];
  userRole?: "owner" | "editor" | "viewer";
  accessDenied?: boolean;
  onRequestAccess?: () => void;
  isRequestingAccess?: boolean;
}

export function EnvVarTable({
  projectId,
  environmentSlug,
  variables,
  userRole,
  accessDenied = false,
  onRequestAccess,
  isRequestingAccess = false,
}: EnvVarTableProps) {
  // Always display A-Z; sort is stable so insertion order is preserved for ties
  const sortedVariables = React.useMemo(
    () => [...variables].sort((a, b) => a.key.localeCompare(b.key)),
    [variables],
  );
  const [editingVariable, setEditingVariable] =
    React.useState<EnvironmentVariable | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [variableToDelete, setVariableToDelete] = React.useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);
  const router = useRouter();

  // Local state for visibility toggles map: variableId -> boolean (true = visible)
  const [visibleSecrets, setVisibleSecrets] = React.useState<
    Record<string, boolean>
  >({});
  const [sharingSecret, setSharingSecret] =
    React.useState<EnvironmentVariable | null>(null);
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const [_lastInteractedId, setLastInteractedId] = React.useState<
    string | null
  >(null);

  // Listen for contextual shortcuts
  React.useEffect(() => {
    return () => {};
  }, []);

  const toggleVisibility = async (id: string, _isCurrentlyVisible: boolean) => {
    setVisibleSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleDeleteClick = (id: string) => {
    setVariableToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!variableToDelete) return;

    setIsDeleting(true);
    const result = await deleteVariableAction(
      variableToDelete,
      projectId,
      environmentSlug,
    );
    if (result.error) {
      toast.error(result.error);
      setIsDeleting(false);
      return;
    }
    toast.success("Variable deleted");
    setDeleteDialogOpen(false);
    setVariableToDelete(null);
    setIsDeleting(false);
    router.refresh();
  };

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px] w-[300px]">Key</TableHead>
              <TableHead className="min-w-[300px]">Value</TableHead>
              <TableHead className="min-w-[200px]">Last Updated</TableHead>
              <TableHead className="w-[100px] text-right min-w-[100px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accessDenied ? (
              <TableRow>
                <TableCell colSpan={4} className="h-28 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-muted-foreground">
                      You don&apos;t have access to this environment.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRequestAccess}
                      disabled={!onRequestAccess || isRequestingAccess}
                    >
                      {isRequestingAccess && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isRequestingAccess ? "Requesting..." : "Request Access"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedVariables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No variables added yet.
                </TableCell>
              </TableRow>
            ) : (
              sortedVariables.map((variable) => {
                const isVisible = visibleSecrets[variable.id];
                return (
                  <TableRow key={variable.id}>
                    <TableCell className="font-mono font-medium">
                      <div className="flex items-center space-x-2">
                        <span>{variable.key}</span>
                        {variable.isShared && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This secret is shared with others</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2 container-type-normal">
                        <div className="font-mono text-sm break-all line-clamp-1 max-w-[400px]">
                          {isVisible ? variable.value : "••••••••••••••••"}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            toggleVisibility(
                              variable.id,
                              !!visibleSecrets[variable.id],
                            );
                          }}
                        >
                          {isVisible ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(variable.value)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy Value</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell>
                      {variable.lastUpdatedAt ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center space-x-2 cursor-help">
                                {variable.userInfo?.updater?.email ? (
                                  <UserAvatar
                                    className="h-6 w-6"
                                    user={{
                                      email: variable.userInfo.updater.email,
                                      avatar: variable.userInfo.updater.avatar,
                                      username:
                                        variable.userInfo.updater.username,
                                      name:
                                        variable.userInfo.updater.username ||
                                        variable.userInfo.updater.email,
                                    }}
                                  />
                                ) : (
                                  <UserAvatar
                                    className="h-6 w-6"
                                    avatarSeed="Former Member"
                                    fallbackType="dicebear"
                                  />
                                )}
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium leading-none">
                                    {variable.userInfo?.updater?.email
                                      ? variable.userInfo.updater.username ||
                                        variable.userInfo.updater.email
                                      : "Former Member"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {variable.lastUpdatedAt
                                      ? (() => {
                                          const date = new Date(
                                            variable.lastUpdatedAt,
                                          );
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
                                      : "-"}
                                  </span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="p-3 text-xs space-y-2">
                              {variable.userInfo?.creator && (
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                                  <span className="text-muted-foreground">
                                    Created by:
                                  </span>
                                  <div className="flex items-center space-x-2">
                                    <UserAvatar
                                      className="h-4 w-4"
                                      user={{
                                        email: variable.userInfo.creator.email,
                                        avatar:
                                          variable.userInfo.creator.avatar,
                                        username:
                                          variable.userInfo.creator.username,
                                        name:
                                          variable.userInfo.creator.username ||
                                          variable.userInfo.creator.email,
                                      }}
                                    />
                                    <span>
                                      {variable.userInfo.creator.username ||
                                        variable.userInfo.creator.email}
                                    </span>
                                  </div>
                                </div>
                              )}
                              <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                                <span className="text-muted-foreground">
                                  Updated by:
                                </span>
                                <div className="flex items-center space-x-2">
                                  {variable.userInfo?.updater?.email ? (
                                    <>
                                      <UserAvatar
                                        className="h-4 w-4"
                                        user={{
                                          email:
                                            variable.userInfo.updater.email,
                                          avatar:
                                            variable.userInfo.updater.avatar,
                                          username:
                                            variable.userInfo.updater.username,
                                          name:
                                            variable.userInfo.updater
                                              .username ||
                                            variable.userInfo.updater.email,
                                        }}
                                      />
                                      <span>
                                        {variable.userInfo.updater.username ||
                                          variable.userInfo.updater.email}
                                      </span>
                                    </>
                                  ) : (
                                    <span>Former Member</span>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-[80px_1fr] gap-2">
                                <span className="text-muted-foreground">
                                  Time:
                                </span>
                                <span>
                                  {variable.lastUpdatedAt ? (
                                    <DateDisplay
                                      date={variable.lastUpdatedAt}
                                      formatType="absolute"
                                    />
                                  ) : (
                                    "-"
                                  )}
                                </span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setLastInteractedId(variable.id)}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => copyToClipboard(variable.key)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Key
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => copyToClipboard(variable.value)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Value
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEditingVariable(variable)}
                            disabled={userRole === "viewer"}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setSharingSecret(variable)}
                            disabled={userRole === "viewer"}
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteClick(variable.id)}
                            disabled={userRole === "viewer"}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {accessDenied ? (
          <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground space-y-3">
            <p>You don&apos;t have access to this environment.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestAccess}
              disabled={!onRequestAccess || isRequestingAccess}
            >
              {isRequestingAccess && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isRequestingAccess ? "Requesting..." : "Request Access"}
            </Button>
          </div>
        ) : sortedVariables.length === 0 ? (
          <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
            No variables added yet.
          </div>
        ) : (
          sortedVariables.map((variable) => {
            const isVisible = visibleSecrets[variable.id];
            return (
              <div
                key={variable.id}
                className="bg-card text-card-foreground p-4 rounded-xl border shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <div className="font-mono font-medium break-all">
                      {variable.key}
                    </div>
                    {variable.isShared && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>This secret is shared with others</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mr-2"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => copyToClipboard(variable.key)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Key
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => copyToClipboard(variable.value)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Value
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingVariable(variable)}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setSharingSecret(variable)}
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteClick(variable.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center space-x-2 bg-muted/40 p-2 rounded-md">
                  <div className="font-mono text-sm break-all line-clamp-2 flex-1">
                    {isVisible ? variable.value : "••••••••••••••••"}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() =>
                      toggleVisibility(
                        variable.id,
                        !!visibleSecrets[variable.id],
                      )
                    }
                  >
                    {isVisible ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(variable.value)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  {variable.lastUpdatedAt &&
                    (() => {
                      const date = new Date(variable.lastUpdatedAt);
                      return isNaN(date.getTime()) ? (
                        <span>Invalid date</span>
                      ) : (
                        <span>
                          Updated{" "}
                          <DateDisplay
                            date={date}
                            addSuffix
                            formatType="relative"
                          />
                        </span>
                      );
                    })()}
                </div>
              </div>
            );
          })
        )}
      </div>

      <VariableDialog
        projectId={projectId}
        environmentSlug={environmentSlug}
        existingVariable={editingVariable || undefined}
        existingVariables={sortedVariables}
        open={!!editingVariable}
        onOpenChange={(open) => !open && setEditingVariable(null)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Variable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this variable? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-2"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
              {!isDeleting && (
                <Kbd variant="primary" size="xs">
                  <CornerDownLeft className="h-3 w-3" />
                </Kbd>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sharingSecret && (
        <ShareSecretModal
          // projectId removed
          secretId={sharingSecret.id}
          secretKey={sharingSecret.key}
          open={!!sharingSecret}
          onOpenChange={(open) => !open && setSharingSecret(null)}
        />
      )}
    </>
  );
}

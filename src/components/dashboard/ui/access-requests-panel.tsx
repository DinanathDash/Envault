"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  Check,
  X,
  Clock,
  Loader2,
  CornerDownLeft,
  Command,
} from "lucide-react";
import { toast } from "sonner";
import { rejectRequest } from "@/app/invite-actions";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AccessRequestSkeleton } from "@/components/notifications/notification-skeleton";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { Kbd } from "@/components/ui/kbd";
import { DateDisplay } from "@/components/ui/date-display";
import { formatEnvironmentLabel } from "@/lib/utils/environment-label";
import { pushWithTransition } from "@/lib/utils/view-transition-navigation";

interface AccessRequest {
  id: string;
  user_id: string;
  project_id: string;
  status: string;
  created_at: string;
  requested_environment?: string | null;
  projects:
    | { name: string; user_id: string }
    | { name: string; user_id: string }[];
  requester_email?: string;
  requester_username?: string;
}

const ModKey = () => (
  <>
    <Command className="w-3 h-3 mac-only" />
    <span className="non-mac-only">Ctrl</span>
  </>
);

export function AccessRequestsPanel() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  const fetchRequests = useCallback(async (shouldSetLoading = true) => {
    if (shouldSetLoading) setLoading(true);
    const supabase = createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch pending requests for projects owned by current user
    const { data } = await supabase
      .from("access_requests")
      .select(
        `
                id,
                user_id,
                project_id,
                status,
                created_at,
                requested_environment,
                projects!inner(name, user_id)
            `,
      )
      .eq("status", "pending")
      .eq("projects.user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch requester emails using admin client via API
      const requestsWithEmails = await Promise.all(
        data.map(async (request) => {
          try {
            const response = await fetch("/api/user-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: request.user_id }),
            });
            const { email, username } = (await response.json()) as {
              email?: string;
              username?: string;
            };
            return {
              ...request,
              requester_email: email,
              requester_username: username,
            };
          } catch {
            return request;
          }
        }),
      );
      setRequests(requestsWithEmails as AccessRequest[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests(false);
  }, [fetchRequests]);

  const handleApproveRedirect = (requestId: string) => {
    pushWithTransition(router, `/approve/${requestId}`);
  };

  const handleReject = async (requestId: string, projectName: string) => {
    setProcessingIds((prev) => new Set(prev).add(requestId));

    const result = await rejectRequest(requestId);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Request rejected for ${projectName}`);
      fetchRequests(); // Refresh list
    }

    setProcessingIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(requestId);
      return newSet;
    });
  };

  // Shortcuts for the first request
  useHotkeys("mod+enter", () => {
    if (requests.length > 0 && !processingIds.has(requests[0].id)) {
      const first = requests[0];
      handleApproveRedirect(first.id);
    }
  });

  if (loading) {
    return <AccessRequestSkeleton />;
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Access Requests</CardTitle>
          <CardDescription>
            Review and manage access requests to your projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No pending requests</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Pending Access Requests
          <Badge variant="secondary">{requests.length}</Badge>
        </CardTitle>
        <CardDescription>
          Review and manage access requests to your projects
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request, index) => {
            const isProcessing = processingIds.has(request.id);
            const project = Array.isArray(request.projects)
              ? request.projects[0]
              : request.projects;
            const projectName = project?.name || "Unknown Project";

            return (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <UserAvatar
                    className="h-10 w-10"
                    user={{
                      email: request.requester_email,
                      username: request.requester_username,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {request.requester_username ||
                        request.requester_email ||
                        "User"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requesting access to{" "}
                      <span className="font-medium">{projectName}</span>
                    </p>
                    {request.requested_environment && (
                      <p className="text-xs text-muted-foreground">
                        Requested environment:{" "}
                        <span className="font-medium">
                          {formatEnvironmentLabel(
                            request.requested_environment,
                          )}
                        </span>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      <DateDisplay
                        date={request.created_at}
                        formatType="absolute"
                      />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleApproveRedirect(request.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Configure Access
                        {index === 0 && (
                          <div className="ml-2 hidden md:flex items-center gap-1">
                            <Kbd variant="primary" size="xs">
                              <ModKey />
                            </Kbd>
                            <Kbd variant="primary" size="xs">
                              <CornerDownLeft className="h-3 w-3" />
                            </Kbd>
                          </div>
                        )}
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(request.id, projectName)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

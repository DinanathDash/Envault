import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ApproveForm } from "./approve-form";
import { UserPlus, XCircle, Lock } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Metadata } from "next";
import { formatEnvironmentLabel } from "@/lib/utils/environment-label";
import { AgentApproveForm } from "./agent-approve-form";

interface ApprovePageProps {
  params: Promise<{ requestId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Approve Access",
    description: "Approve or deny project access requests.",
    openGraph: {
      siteName: "Envault",
      images: [
        "/api/og?title=Approve%20Access&description=Manage%20project%20collaboration%20requests",
      ],
    },
  };
}

export default async function ApprovePage({ params }: ApprovePageProps) {
  const { requestId } = await params;
  const supabase = await createClient();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/approve/${requestId}`);
  }

  // Fetch request details
  const { data: request, error: requestError } = await supabase
    .from("access_requests")
    .select("*, projects!inner(user_id, name, ui_mode), requested_environment")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    const { data: pendingApproval } = await admin
      .from("pending_approvals")
      .select("id, status, payload_hash, project_id, agent_id, projects(name, user_id, slug)")
      .eq("id", requestId)
      .single();

    if (pendingApproval) {
      const projectOwnerId =
        (pendingApproval.projects as unknown as { user_id?: string } | null)
          ?.user_id || null;

      const { data: member } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", pendingApproval.project_id)
        .eq("user_id", user.id)
        .in("role", ["owner", "editor"])
        .single();

      const isProjectOwner = projectOwnerId === user.id;
      if (!isProjectOwner && !member) {
        redirect("/dashboard");
      }

      const projectName =
        (pendingApproval.projects as unknown as { name?: string } | null)?.name ||
        "Project";
      const projectSlug =
        (pendingApproval.projects as unknown as { slug?: string } | null)
          ?.slug || "";
      const ownerUsername = projectOwnerId
        ? (
            await admin
              .from("profiles")
              .select("username")
              .eq("id", projectOwnerId)
              .maybeSingle()
          ).data?.username || ""
        : "";
      const redirectPath = isProjectOwner
        ? projectSlug
          ? `/project/${projectSlug}`
          : "/dashboard"
        : ownerUsername && projectSlug
          ? `/${ownerUsername}/${projectSlug}`
          : "/dashboard";

      return (
        <AuthLayout>
          <div className="w-[90vw] sm:w-full sm:max-w-md mx-auto">
            <Card className="border-muted/40 shadow-2xl backdrop-blur-sm bg-background/80">
              <CardHeader className="text-center space-y-2">
                <div className="flex justify-center mb-2">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <UserPlus className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  Agent Approval Required
                </CardTitle>
                <CardDescription>
                  Agent request for <span className="font-medium text-foreground">{projectName}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Status: <span className="font-medium text-foreground">Pending</span>
                </p>
                <AgentApproveForm
                  requestId={requestId}
                  redirectPath={redirectPath}
                />
                <Button variant="ghost" asChild className="w-full h-11">
                  <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
              </CardContent>
              <CardFooter className="justify-center text-xs text-muted-foreground">
                <Lock className="w-3 h-3 mr-1" />
                End-to-end encrypted environment
              </CardFooter>
            </Card>
          </div>
        </AuthLayout>
      );
    }

    return (
      <AuthLayout>
        <div className="w-[90vw] sm:w-full sm:max-w-md mx-auto">
          <Card className="border-muted/40 shadow-2xl backdrop-blur-sm bg-background/80">
            <CardHeader className="text-center space-y-2">
              <div className="flex justify-center mb-2">
                <div className="p-3 bg-destructive/10 rounded-full">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Request Not Found
              </CardTitle>
              <CardDescription>
                This access request may have already been processed or deleted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full h-11" variant="outline">
                <Link href="/dashboard">Return to Dashboard</Link>
              </Button>
            </CardContent>
            <CardFooter className="justify-center text-xs text-muted-foreground">
              <Lock className="w-3 h-3 mr-1" />
              End-to-end encrypted environment
            </CardFooter>
          </Card>
        </div>
      </AuthLayout>
    );
  }

  // Verify User is Owner of the Project
  interface RequestProject {
    user_id: string;
    name: string;
    ui_mode: string;
  }
  const projectInfo = request.projects as unknown as RequestProject;
  const projectOwner = projectInfo.user_id;
  if (projectOwner !== user.id) {
    redirect("/dashboard");
  }

  // Get requester email using admin client
  const { data: requester } = await admin.auth.admin.getUserById(
    request.user_id,
  );
  const requesterEmail = requester?.user?.email || "Unknown User";

  // Fetch project environments ONLY if advanced mode
  let environments: string[] = [];
  if (projectInfo.ui_mode === "advanced") {
    const { data: environmentsData } = await admin
      .from("project_environments")
      .select("slug")
      .eq("project_id", request.project_id);

    environments = environmentsData?.map((e) => e.slug) || [];
  }

  const { data: existingMember } = await admin
    .from("project_members")
    .select("role, allowed_environments")
    .eq("project_id", request.project_id)
    .eq("user_id", request.user_id)
    .single();

  const existingRole = existingMember?.role === "editor" ? "editor" : "viewer";
  const existingAllowedEnvironments = existingMember?.allowed_environments as
    | string[]
    | null
    | undefined;

  return (
    <AuthLayout>
      <div className="w-[90vw] sm:w-full sm:max-w-md mx-auto">
        <Card className="border-muted/40 shadow-2xl backdrop-blur-sm bg-background/80">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-primary/10 rounded-full">
                <UserPlus className="w-10 h-10 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Access Request
            </CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">
                {requesterEmail}
              </span>{" "}
              wants to collaborate on{" "}
              <span className="font-medium text-foreground">
                {projectInfo.name}
              </span>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {request.requested_environment && (
              <p className="text-sm text-muted-foreground">
                Requested environment:{" "}
                <span className="font-medium text-foreground">
                  {formatEnvironmentLabel(request.requested_environment)}
                </span>
              </p>
            )}
            <ApproveForm
              requestId={requestId}
              environments={environments}
              requestedEnvironment={request.requested_environment || undefined}
              existingRole={existingRole}
              existingAllowedEnvironments={existingAllowedEnvironments}
            />
            <Button variant="ghost" asChild className="w-full h-11">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
          <CardFooter className="justify-center text-xs text-muted-foreground">
            <Lock className="w-3 h-3 mr-1" />
            End-to-end encrypted environment
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  );
}

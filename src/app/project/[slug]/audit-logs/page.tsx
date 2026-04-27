import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { AuditLogsView } from "@/components/dashboard/views/audit-logs-view";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Audit Logs - ${slug}`,
  };
}

export default async function AuditLogsPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch project by slug, then verify user membership via getProjectRole
  const { data: projects, error: _projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("slug", slug)
    .limit(20);

  if (_projectError || !projects || projects.length === 0) {
    notFound();
  }

  // Verify user can access this project
  const { getProjectRole } = await import("@/lib/auth/permissions");
  const roleChecks = await Promise.all(
    projects.map(async (candidate) => ({
      project: candidate,
      role: await getProjectRole(supabase, candidate.id, user.id),
    })),
  );
  const accessible = roleChecks.find((entry) => Boolean(entry.role));

  if (!accessible) {
    redirect(`/project/${slug}`);
  }
  const project = accessible.project;

  return (
    <AuthenticatedShell
      title={`${project.name} - Audit Logs`}
      backTo={`/project/${slug}`}
      hideSearch
    >
      <main className="container mx-auto py-8 flex-1 px-4">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          Project Audit Logs
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          Chronological log of activities and security events for {project.name}
          . Data is retained for 7 days.
        </p>

        <div className="mt-4">
          {/* We pass a simplified Project object to reuse the same prop structure, or just pass projectId */}
          <AuditLogsView projectId={project.id} />
        </div>
      </main>
    </AuthenticatedShell>
  );
}

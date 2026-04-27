import { DashboardClient, ProjectSkeletonGrid } from "./dashboard-client";
import { getProjects } from "@/app/project-actions";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";

export default async function DashboardLogic() {
  const result = await getProjects();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects = (result.data as any) || [];

  return (
    <AuthenticatedShell>
      <DashboardClient initialProjects={projects} />
    </AuthenticatedShell>
  );
}

export { ProjectSkeletonGrid };

import DashboardLogic, {
  ProjectSkeletonGrid,
} from "@/components/dashboard/views/dashboard-view";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "View and manage all your secure environment variable projects.",
  openGraph: {
    siteName: "Envault",
    images: ["/open-graph/Dashboard%20OG.png"],
  },
};

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <AuthenticatedShell>
          <main className="container mx-auto py-8 px-4 space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-4 w-full max-w-64" />
              </div>
              <Skeleton className="h-12 w-full rounded-xl sm:w-[240px]" />
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
              <ProjectSkeletonGrid />
            </div>
          </main>
        </AuthenticatedShell>
      }
    >
      <DashboardLogic />
    </Suspense>
  );
}

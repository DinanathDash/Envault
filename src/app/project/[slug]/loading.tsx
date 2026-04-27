import { Skeleton } from "@/components/ui/skeleton";
import { EnvVarTableSkeleton } from "@/components/editor/env-var-table-skeleton";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";

export default function Loading() {
  return (
    <AuthenticatedShell title={<Skeleton className="h-7 w-56" />} backTo="/dashboard" hideSearch>
      <main className="container mx-auto py-8 px-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
          <div className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-full max-w-72" />
            <div className="flex max-w-full gap-2 overflow-hidden">
              <Skeleton className="h-10 w-28 rounded-lg sm:w-40" />
              <Skeleton className="h-10 w-24 rounded-lg sm:w-36" />
              <Skeleton className="h-10 w-24 rounded-lg sm:w-36" />
            </div>
            <Skeleton className="h-7 w-full max-w-96" />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Skeleton className="h-10 w-full rounded-md sm:w-36" />
            <Skeleton className="h-10 w-full rounded-md sm:w-36" />
            <Skeleton className="h-10 w-full rounded-md sm:w-36" />
          </div>
        </div>

        <EnvVarTableSkeleton />
      </main>
    </AuthenticatedShell>
  );
}

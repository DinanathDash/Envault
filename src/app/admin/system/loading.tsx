import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AuthenticatedShell
      title="System Status Center"
      backTo="/dashboard"
      hideSearch
    >
      <main className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-[calc(50%-0.25rem)] rounded-md sm:w-40" />
          <Skeleton className="h-10 w-[calc(50%-0.25rem)] rounded-md sm:w-40" />
        </div>
        <div className="space-y-3 rounded-xl border p-4">
          <Skeleton className="h-7 w-full max-w-64" />
          <Skeleton className="h-4 w-full max-w-96" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      </main>
    </AuthenticatedShell>
  );
}

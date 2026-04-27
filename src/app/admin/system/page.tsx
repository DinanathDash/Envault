import { getComponents, getIncidents } from "@/actions/status";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SystemStatusView from "./system-status-view";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { Viewport, Metadata } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Envault system administration.",
  openGraph: {
    siteName: "Envault",
    images: ["/open-graph/Dashboard%20OG.png"],
  },
};

export default async function AdminStatusPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Admin Check
  const isAdmin = user.app_metadata?.is_admin === true;
  if (!isAdmin) {
    redirect("/dashboard"); // Or a 403 page
  }

  const components = await getComponents();
  const incidents = await getIncidents(); // Fetch recent 10

  return (
    <Suspense
      fallback={
        <AuthenticatedShell
          title="System Status Center"
          backTo="/dashboard"
          hideSearch
        >
          <main className="container mx-auto py-8 px-4 space-y-6">
            <div className="flex gap-2">
              <Skeleton className="h-10 w-40 rounded-md" />
              <Skeleton className="h-10 w-40 rounded-md" />
            </div>
            <div className="space-y-3 rounded-xl border p-4">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-96" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </main>
        </AuthenticatedShell>
      }
    >
      <SystemStatusView
        initialComponents={components}
        initialIncidents={incidents}
      />
    </Suspense>
  );
}

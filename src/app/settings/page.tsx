import SettingsView from "@/components/settings/settings-view";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Manage your Envault account settings, API keys, and preferences.",
  openGraph: {
    siteName: "Envault",
    images: ["/open-graph/Dashboard%20OG.png"],
  },
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <Suspense
      fallback={
        <AuthenticatedShell title="Settings" backTo="/dashboard" hideSearch>
          <main className="container mx-auto py-8 px-4">
            <div className="flex flex-col gap-8 md:flex-row">
              <aside className="w-full space-y-2 md:w-64">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </aside>
              <div className="flex-1 space-y-4">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-[420px] w-full rounded-xl" />
              </div>
            </div>
          </main>
        </AuthenticatedShell>
      }
    >
      <SettingsView />
    </Suspense>
  );
}

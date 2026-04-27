import Link from "next/link";
import { FolderX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";

export default function ProjectNotFound() {
  return (
    <AuthenticatedShell
      title="Project Not Found"
      backTo="/dashboard"
      hideSearch
    >
      <main className="container mx-auto py-16 px-4">
        <div className="flex flex-col items-center justify-center text-foreground text-center p-4">
          <div className="bg-muted p-6 rounded-full mb-6">
            <FolderX className="w-16 h-16 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">
            Project not found
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            This project cannot be found. It may have been renamed, deleted, or
            you lack access to view it.
          </p>
          <Button asChild>
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </div>
      </main>
    </AuthenticatedShell>
  );
}

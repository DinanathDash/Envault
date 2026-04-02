import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { GitHubConnectedContent } from "./github-connected-client";

export default function GitHubConnectedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        }
      >
        <GitHubConnectedContent />
      </Suspense>
    </div>
  );
}

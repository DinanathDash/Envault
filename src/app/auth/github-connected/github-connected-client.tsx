"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Github, Loader2 } from "lucide-react";

export function GitHubConnectedContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug");
  const [status, setStatus] = useState<"navigating" | "done" | "no-opener">(
    "navigating",
  );

  useEffect(() => {
    if (!slug) return;

    const target = `/project/${slug}?success=github_linked`;
    console.log("[GitHub Connected] slug:", slug);

    if (window.opener && !window.opener.closed) {
      console.log("[GitHub Connected] Navigating opener to:", target);
      window.opener.location.href = target;
      setTimeout(() => {
        setStatus("done");
        window.close();
      }, 800);
    } else {
      console.warn("[GitHub Connected] No opener found - navigating self.");
      setTimeout(() => setStatus("no-opener"), 0);
      window.location.href = target;
    }
  }, [slug]);

  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
      <div className="flex items-center gap-2 text-green-600">
        <Github className="h-8 w-8" />
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-semibold">GitHub App Connected!</h1>
      {status === "navigating" && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Returning you to Envault...
        </p>
      )}
      {status === "done" && (
        <p className="text-sm text-muted-foreground">
          Done! This tab will close automatically.
        </p>
      )}
      {status === "no-opener" && (
        <p className="text-sm text-muted-foreground">
          Redirecting you back to the project...
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type AgentApproveFormProps = {
  requestId: string;
  redirectPath: string;
};

export function AgentApproveForm({ requestId, redirectPath }: AgentApproveFormProps) {
  const router = useRouter();
  const [submittingAction, setSubmittingAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitAction = async (action: "approve" | "reject") => {
    try {
      setSubmittingAction(action);
      setError(null);

      const res = await fetch(`/api/approve/${requestId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const body = await res.text();
        let parsedError: string | null = null;
        try {
          const parsed = JSON.parse(body) as { error?: string };
          parsedError = parsed.error || null;
        } catch {
          parsedError = null;
        }
        throw new Error(parsedError || body || "Approval request failed");
      }

      router.push(redirectPath || "/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval request failed");
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button
          className="flex-1"
          variant="outline"
          onClick={() => submitAction("reject")}
          disabled={submittingAction !== null}
        >
          {submittingAction === "reject" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Reject
        </Button>
        <Button
          className="flex-1"
          onClick={() => submitAction("approve")}
          disabled={submittingAction !== null}
        >
          {submittingAction === "approve" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Approve and Execute
        </Button>
      </div>
    </div>
  );
}

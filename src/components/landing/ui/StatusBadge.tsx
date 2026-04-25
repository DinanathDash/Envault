"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { STATUS_CONFIG, type StatusLevel } from "@/lib/system/status-config";
import type { SystemStatusSummary } from "@/lib/system/system-status";

export function StatusBadge() {
  const [level, setLevel] = useState<StatusLevel | "loading">("loading");

  useEffect(() => {
    fetch("/api/system-status", { cache: "default" })
      .then((r) => r.json() as Promise<SystemStatusSummary>)
      .then((data: SystemStatusSummary) => {
        // Guard against unexpected/missing level values from stale cache
        const safeLevel =
          data.level in STATUS_CONFIG ? data.level : "operational";
        setLevel(safeLevel as StatusLevel);
      })
      .catch(() => setLevel("operational"));
  }, []);

  if (level === "loading") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-border/50 bg-muted/20 text-muted-foreground opacity-50 cursor-wait">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" />
        Checking status...
      </div>
    );
  }

  const cfg = STATUS_CONFIG[level] ?? STATUS_CONFIG.operational;
  const Icon = cfg.icon;

  return (
    <Link
      href="/status"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold tracking-tight transition-all duration-300 border ${cfg.border} ${cfg.bg} ${cfg.color} hover:scale-105`}
    >
      <Icon className="size-4 shrink-0 animate-pulse" />
      {cfg.label}.
    </Link>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { SystemStatusSummary } from "@/lib/system/system-status";
import { STATUS_CONFIG } from "@/lib/system/status-config";
import { cn } from "@/lib/utils/utils";

const DISMISS_KEY = "envault:status-banner-dismissed";

interface SystemStatusBannerProps {
  show: boolean;
}

export function SystemStatusBanner({ show }: SystemStatusBannerProps) {
  const [status, setStatus] = useState<SystemStatusSummary | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return sessionStorage.getItem(DISMISS_KEY) !== null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!show || dismissed) return;
    fetch("/api/system-status", { cache: "default" })
      .then((r) => r.json() as Promise<SystemStatusSummary>)
      .then((data: SystemStatusSummary) => setStatus(data))
      .catch(() => {});
  }, [show, dismissed]);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {}
    setDismissed(true);
  };

  const isVisible =
    show && !dismissed && status !== null && status.level !== "operational";

  const cfg =
    status?.level && status.level !== "operational"
      ? STATUS_CONFIG[status.level]
      : null;

  if (!isVisible || !cfg || !status) return null;

  const Icon = cfg.icon;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key="status-banner"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-hidden"
      >
        <div
          role="alert"
          aria-live="polite"
          className={cn(
            "relative w-full border-b",
            cfg.bg,
            cfg.border,
            cfg.color,
          )}
        >
          {/* Diagonal stripe overlay - uses currentColor so it inverts in dark mode automatically */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0, transparent 14px, currentColor 14px, currentColor 22px)",
              opacity: 0.03,
            }}
          />
          {/* Centred content row - dismiss is absolute so it never shifts the centre */}
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 py-2 pl-4 pr-10 sm:gap-2.5">
            {/* Naked icon matching status page exactly */}
            <Icon
              className={cn("size-[18px] shrink-0 animate-pulse", cfg.color)}
              strokeWidth={2.5}
            />

            {/* Primary bold message - truncates on very small screens */}
            <span className="min-w-0 truncate text-sm font-semibold text-foreground/80 sm:truncate">
              {status.message ?? cfg.label}
            </span>

            {/* Arrow separator - hidden on mobile */}
            <ArrowRight
              className="hidden size-3 shrink-0 text-foreground/30 sm:block"
              aria-hidden
            />

            {/* Muted secondary text + coloured inline link - hidden on mobile */}
            <span className="hidden shrink-0 text-sm text-foreground/55 sm:inline">
              Follow the{" "}
              <Link
                href="/status"
                target="_blank"
                className={cn(
                  "underline underline-offset-2 decoration-current/40",
                  "hover:decoration-current transition-colors duration-150",
                  cfg.color,
                )}
              >
                status page
              </Link>{" "}
              for updates
            </span>

            {/* On mobile: inline link directly after message */}
            <Link
              href="/status"
              className={cn(
                "shrink-0 text-sm underline underline-offset-2 decoration-current/40",
                "hover:decoration-current transition-colors duration-150 sm:hidden",
                cfg.color,
              )}
            >
              View status
            </Link>
          </div>

          {/* Dismiss - absolute right so centred content is never displaced */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss status banner"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex cursor-pointer items-center justify-center rounded-full p-1.5 text-foreground/35 hover:text-foreground/70 transition-colors duration-150"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

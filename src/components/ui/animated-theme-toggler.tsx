"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { Kbd } from "./kbd";

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number;
}

let themeToggleInFlight = false;
const VT_DISABLE_SESSION_KEY = "envault:disable-advanced-theme-transition";

type ThemeTransitionStrategy = {
  useAdvanced: boolean;
};

let cachedStrategy: ThemeTransitionStrategy | null = null;

function getThemeTransitionStrategy(): ThemeTransitionStrategy {
  if (cachedStrategy) return cachedStrategy;

  if (typeof window === "undefined" || typeof document === "undefined") {
    cachedStrategy = { useAdvanced: false };
    return cachedStrategy;
  }

  const isReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (isReducedMotion) {
    cachedStrategy = { useAdvanced: false };
    return cachedStrategy;
  }

  if (window.sessionStorage.getItem(VT_DISABLE_SESSION_KEY) === "1") {
    cachedStrategy = { useAdvanced: false };
    return cachedStrategy;
  }

  if (!document.startViewTransition) {
    cachedStrategy = { useAdvanced: false };
    return cachedStrategy;
  }

  const supportsMask =
    CSS.supports("mask-size", "1px") || CSS.supports("-webkit-mask-size", "1px");
  if (!supportsMask) {
    cachedStrategy = { useAdvanced: false };
    return cachedStrategy;
  }

  const ua = navigator.userAgent;
  const isDuckDuckGo = /DuckDuckGo/i.test(ua);
  const isSafari =
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|Arc/i.test(ua);
  if (isDuckDuckGo || isSafari) {
    cachedStrategy = { useAdvanced: false };
    return cachedStrategy;
  }

  const isEdge = /Edg/i.test(ua);
  if (isEdge) {
    cachedStrategy = { useAdvanced: false };
    return cachedStrategy;
  }

  const isChromiumFamily = /Chrome|Chromium|CriOS|Edg|OPR|Brave|Vivaldi|Arc/i.test(ua);
  if (!isChromiumFamily) {
    cachedStrategy = { useAdvanced: false };
    return cachedStrategy;
  }

  cachedStrategy = { useAdvanced: true };
  return cachedStrategy;
}

function tripThemeTransitionSafetyFuse() {
  window.sessionStorage.setItem(VT_DISABLE_SESSION_KEY, "1");
  cachedStrategy = { useAdvanced: false };
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  ...props
}: AnimatedThemeTogglerProps) => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true); // Avoid hydration mismatch
  }, []);

  const toggleTheme = useCallback(() => {
    if (!buttonRef.current) return;
    if (themeToggleInFlight) return;
    themeToggleInFlight = true;

    const isDark = resolvedTheme === "dark";
    const newTheme = isDark ? "light" : "dark";

    const strategy = getThemeTransitionStrategy();

    if (!strategy.useAdvanced) {
      setTheme(newTheme);
      themeToggleInFlight = false;
      return;
    }

    // Freeze old root background and disable standard CSS transitions so it doesn't jarringly crossfade while expanding
    document.documentElement.classList.add("disable-transitions", "theme-transitioning");
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.documentElement.classList.remove(
            "disable-transitions",
            "theme-transitioning",
          );
          themeToggleInFlight = false;
        });
      });
    };

    // Fallback cleanup in case the View Transition promise never settles.
    // Keep this longer than the CSS mask animation to avoid tearing down classes mid-transition.
    const fallbackTimer = window.setTimeout(() => {
      tripThemeTransitionSafetyFuse();
      cleanup();
    }, Math.max(duration + 300, 1800));

    try {
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          setTheme(newTheme);
        });
      });

      transition.finished
        .catch(() => {
          tripThemeTransitionSafetyFuse();
        })
        .finally(() => {
          window.clearTimeout(fallbackTimer);
          cleanup();
        });
    } catch {
      window.clearTimeout(fallbackTimer);
      tripThemeTransitionSafetyFuse();
      cleanup();
      setTheme(newTheme);
    }
  }, [duration, resolvedTheme, setTheme]);

  if (!mounted) {
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleTheme}
        className={cn(
          "cursor-pointer transition-transform duration-300 ease-out motion-reduce:transition-none",
          className,
        )}
        data-theme-toggle
        {...props}
      >
        <Moon
          className="w-5 h-5 transition-transform duration-500 ease-out motion-reduce:transition-none"
        />
        <span className="sr-only">Toggle theme (t)</span>
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleTheme}
          className={cn(
            "cursor-pointer transition-transform duration-300 ease-out motion-reduce:transition-none",
            className,
          )}
          data-theme-toggle
          {...props}
        >
          {isDark ? (
            <Sun
              className="w-5 h-5 transition-transform duration-500 ease-out motion-reduce:transition-none"
            />
          ) : (
            <Moon
              className="w-5 h-5 transition-transform duration-500 ease-out motion-reduce:transition-none"
            />
          )}
          <span className="sr-only">Toggle theme (t)</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="flex items-center gap-2">
          Toggle theme <Kbd>T</Kbd>
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

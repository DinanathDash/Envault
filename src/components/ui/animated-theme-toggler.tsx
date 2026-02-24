"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { Kbd } from "./kbd";

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true); // Avoid hydration mismatch
  }, []);

  const toggleTheme = useCallback(() => {
    if (!buttonRef.current) return;

    const isDark = resolvedTheme === "dark";
    const newTheme = isDark ? "light" : "dark";

    // Use View Transition only on non-canvas elements
    if (document.startViewTransition) {
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          setTheme(newTheme);
        });
      });

      transition.ready.then(() => {
        // Apply ripple animation from button
        if (!buttonRef.current) return;
        
        const { top, left, width, height } =
          buttonRef.current.getBoundingClientRect();
        const x = left + width / 2;
        const y = top + height / 2;
        const maxRadius = Math.hypot(
          Math.max(left, window.innerWidth - left),
          Math.max(top, window.innerHeight - top),
        );

        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      });
    } else {
      // Fallback for browsers without View Transition API
      setTheme(newTheme);
    }
  }, [resolvedTheme, setTheme, duration]);

  if (!mounted) {
    return (
      <button
        ref={buttonRef}
        onClick={toggleTheme}
        className={cn(className)}
        data-theme-toggle
        {...props}
      >
        <Moon className="w-5 h-5" />
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
          onClick={toggleTheme}
          className={cn(className)}
          data-theme-toggle
          {...props}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
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

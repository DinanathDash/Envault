"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ScrollProgressProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** 0-1. When provided, uses this value instead of window scroll position. */
  progress?: number;
}

export function ScrollProgress({
  size = 24,
  strokeWidth = 1.5,
  className,
  progress: externalProgress,
}: ScrollProgressProps) {
  const [windowProgress, setWindowProgress] = useState(0);

  useEffect(() => {
    if (externalProgress !== undefined) return;
    function handleScroll() {
      const scrollable = document.body.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      setWindowProgress(Math.min(window.scrollY / scrollable, 1));
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [externalProgress]);

  const progress =
    externalProgress !== undefined ? externalProgress : windowProgress;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg
      width={size}
      height={size}
      className={className}
      aria-label={`Page scroll progress: ${Math.round(progress * 100)}%`}
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={strokeWidth}
        opacity={0.5}
      />
      {/* Progress - starts at 12 o'clock via rotate(-90) */}
      <g transform={`rotate(-90, ${cx}, ${cy})`}>
        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference * (1 - progress) }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{
            type: "spring",
            stiffness: 120,
            damping: 30,
            mass: 0.5,
          }}
        />
      </g>
    </svg>
  );
}

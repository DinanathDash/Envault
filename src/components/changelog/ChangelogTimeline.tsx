"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useSpring,
  useVelocity,
  useMotionValue,
  useAnimationFrame,
  useMotionTemplate,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Command as CommandIcon,
  CornerDownLeft,
  Dot,
} from "lucide-react";
import Link from "next/link";
import {
  MDXRemote,
  type MDXRemoteSerializeResult,
  type MDXRemoteProps,
} from "next-mdx-remote";
import { cn } from "@/lib/utils/utils";
import { RegMark } from "@/components/landing/ui/RegMark";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { SlideUp } from "@/components/landing/animations/SlideUp";
import { FadeIn } from "@/components/landing/animations/FadeIn";
import { Kbd } from "@/components/ui/kbd";
import type { Author } from "@/lib/system/changelog-parser";

// --- Tunable Constants --------------------------------------------------------
const BEAM_LENGTH = 160;
const SPRING_STIFFNESS = 100;
const SPRING_DAMPING = 30;
const FADE_TIMEOUT_MS = 400;
const FADE_DURATION_S = 0.5;

/**
 * Implementation Notes:
 * 1. The Comet uses a stroke-dash technique. By keeping the gap huge (1e6), it appears as a finite beam.
 * 2. Scroll mapping uses Framer Motion's `useScroll` with `useSpring` to smoothly animate `strokeDashoffset`, avoiding jumping.
 * 3. The `showComet` state listens directly to `springScroll` changes to gracefully fade in and out during scroll and rest.
 * 4. The `theme-aware gradient` is applied via CSS variables `var(--foreground)` inside the `<defs>` moving exactly with the dash offsets.
 */

// --- Types -------------------------------------------------------------------

export interface TimelineEntry {
  version: string;
  date: string;
  category: string;
  title?: string;
  bodyMdx: MDXRemoteSerializeResult;
  slug: string;
  authors: Author[];
}

interface TimelineProps {
  entries: TimelineEntry[];
}

type PaginationItem = number | "ellipsis";

// --- Badge colours ------------------------------------------------------------

const BADGE_STYLES: Record<string, string> = {
  security:
    "bg-red-200/80 text-red-800 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/40",
  cli: "bg-zinc-200/80 text-zinc-800 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700/50",
  integrations:
    "bg-violet-200/80 text-violet-800 border border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/40",
  email:
    "bg-sky-200/80 text-sky-800 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/40",
  api: "bg-emerald-200/80 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40",
  ui: "bg-amber-200/80 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40",
  docs: "bg-blue-200/80 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/40",
  fix: "bg-orange-200/80 text-orange-800 border border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/40",
  performance:
    "bg-teal-200/80 text-teal-800 border border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/40",
  release:
    "bg-zinc-200/80 text-zinc-700 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700/50",
};

function getBadgeStyle(category: string): string {
  return BADGE_STYLES[category.toLowerCase()] ?? BADGE_STYLES.release;
}

function getPaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [
      1,
      "ellipsis",
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ];
}

function renderInlineMarkdown(
  text: string,
  keyPrefix: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenPattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      nodes.push(
        <strong
          key={`${keyPrefix}-strong-${tokenIndex}`}
          className="font-semibold text-foreground/90"
        >
          {match[1]}
        </strong>,
      );
    } else if (match[2]) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${tokenIndex}`}
          className="text-xs font-mono bg-muted/60 text-primary px-1 py-0.5 rounded-sm"
        >
          {match[2]}
        </code>,
      );
    } else if (match[3] && match[4]) {
      const href = match[4];
      const textValue = match[3];
      const isInternal = href.startsWith("/");

      nodes.push(
        isInternal ? (
          <Link
            key={`${keyPrefix}-link-${tokenIndex}`}
            href={href}
            className="text-primary hover:underline underline-offset-4"
          >
            {textValue}
          </Link>
        ) : (
          <a
            key={`${keyPrefix}-link-${tokenIndex}`}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary hover:underline underline-offset-4"
          >
            {textValue}
          </a>
        ),
      );
    }

    lastIndex = tokenPattern.lastIndex;
    tokenIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

const changelogMdxComponents: MDXRemoteProps["components"] = {
  Kbd: ({ className, ...props }: React.ComponentProps<typeof Kbd>) => (
    <Kbd className={cn("align-middle", className)} {...props} />
  ),
  Command: ({ className }: React.ComponentProps<"svg">) => (
    <CommandIcon className={cn("block w-4 h-4 shrink-0", className)} />
  ),
  CornerDownLeft: ({ className }: React.ComponentProps<"svg">) => (
    <CornerDownLeft className={cn("block w-4 h-4 shrink-0", className)} />
  ),
  ChevronRight: ({ className }: React.ComponentProps<"svg">) => (
    <ChevronRight className={cn("block w-4 h-4 shrink-0", className)} />
  ),
  p: ({ className, children, ...props }: React.ComponentProps<"p">) => (
    <p
      className={cn(
        "text-sm text-muted-foreground leading-relaxed my-1.5",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  ),
  h3: ({ className, children, ...props }: React.ComponentProps<"h3">) => (
    <h3
      className={cn(
        "text-sm font-semibold text-foreground/80 mt-4 mb-2 uppercase tracking-wider font-mono first:mt-0",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  ),
  ul: ({ className, children, ...props }: React.ComponentProps<"ul">) => (
    <ul className={cn("space-y-1.5 my-2", className)} {...props}>
      {children}
    </ul>
  ),
  li: ({ className, children, ...props }: React.ComponentProps<"li">) => (
    <li
      className={cn(
        "text-sm text-muted-foreground flex gap-2 leading-relaxed",
        className,
      )}
      {...props}
    >
      <ChevronRight className="h-4 w-4 text-primary/50 mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  ),
  a: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      {...props}
      className="text-primary hover:underline underline-offset-4"
      target={href?.startsWith("/") ? undefined : "_blank"}
      rel={href?.startsWith("/") ? undefined : "noreferrer noopener"}
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }: React.ComponentProps<"code">) => (
    <code
      className={cn(
        "text-xs font-mono bg-muted/60 text-primary px-1 py-0.5 rounded-sm",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  ),
};

// --- Circuit-path SVG ---------------------------------------------------------

const SVG_W = 40;
const CX = SVG_W / 2;
const TRACK_JOG_X = 20;
const TRACK_JOG_Y = 20;
const TRACK_TITLE_GAP = 8;
const TRACK_BODY_GAP = 10;

interface TrackMath {
  d: string;
  dotLengths: number[];
}

function buildPath(ys: number[], tYs: number[], bYs: number[]): TrackMath {
  if (ys.length === 0) return { d: "", dotLengths: [] };
  const parts = [`M ${CX} ${ys[0]}`];
  let currentLen = 0;
  let currentY = ys[0];
  let currentX = CX;

  const dotLengths: number[] = [0];

  function pushLine(nx: number, ny: number) {
    const dx = nx - currentX;
    const dy = ny - currentY;
    currentLen += Math.sqrt(dx * dx + dy * dy);
    currentX = nx;
    currentY = ny;
    parts.push(`L ${nx} ${ny}`);
  }

  for (let i = 0; i < ys.length; i++) {
    const tY = tYs[i];
    const bY = bYs[i];

    const jogStartY = (tY || ys[i]) + TRACK_TITLE_GAP;
    const jogEndY = (bY || ys[i]) + TRACK_BODY_GAP;

    const safeNextY =
      i < ys.length - 1 ? ys[i + 1] : jogEndY + TRACK_JOG_Y + 20;

    if (tY && bY && jogEndY > jogStartY + TRACK_JOG_Y) {
      if (jogEndY + TRACK_JOG_Y < safeNextY) {
        pushLine(CX, jogStartY);
        pushLine(CX + TRACK_JOG_X, jogStartY + TRACK_JOG_Y);
        pushLine(CX + TRACK_JOG_X, jogEndY);
        pushLine(CX, jogEndY + TRACK_JOG_Y);
      }
    }

    pushLine(CX, safeNextY);

    if (i < ys.length - 1) {
      dotLengths.push(currentLen);
    }
  }

  return { d: parts.join(" "), dotLengths };
}

// --- Author chip --------------------------------------------------------------

function AuthorChip({ author }: { author: Author }) {
  const [imgError, setImgError] = useState(false);
  const initials = author.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full overflow-hidden border border-border/50 shrink-0 bg-muted flex items-center justify-center">
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://github.com/${author.github}.png?size=64`}
            alt={author.name}
            width={28}
            height={28}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-[9px] font-mono text-muted-foreground leading-none">
            {initials}
          </span>
        )}
      </div>
      <span className="text-sm text-muted-foreground">{author.name}</span>
    </div>
  );
}

// --- Mobile version nav -------------------------------------------------------

function MobileVersionNav({
  entries,
  activeSlug,
  onSelect,
}: {
  entries: TimelineEntry[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = entries.find((e) => e.slug === activeSlug) ?? entries[0];

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 md:px-6 py-3 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <ScrollProgress
            size={16}
            strokeWidth={1.5}
            className="shrink-0 opacity-80"
            progress={
              entries.length > 1
                ? entries.findIndex((e) => e.slug === activeSlug) /
                  (entries.length - 1)
                : 1
            }
          />
          <span className="truncate text-foreground font-medium">
            v{active?.version}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 shrink-0 ml-2 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 z-50 bg-background backdrop-blur-md border-b border-border/50 shadow-md"
          >
            <div className="relative">
              <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background/90 to-transparent z-10" />
              <nav className="px-4 md:px-6 py-2 space-y-0.5 max-h-64 overflow-y-auto">
                {entries.map((entry) => {
                  const isActive = entry.slug === activeSlug;
                  return (
                    <button
                      key={entry.slug}
                      onClick={() => {
                        onSelect(entry.slug);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-md text-sm transition-colors",
                        isActive
                          ? "text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                      )}
                    >
                      <span className="flex-1 font-mono">v{entry.version}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/90 to-transparent z-10" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Main component -----------------------------------------------------------

export function ChangelogTimeline({ entries }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  const bodyRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [nodeYs, setNodeYs] = useState<number[]>([]);
  const [titleYs, setTitleYs] = useState<number[]>([]);
  const [bodyYs, setBodyYs] = useState<number[]>([]);

  const [svgHeight, setSvgHeight] = useState(0);
  const [activeSlug, setActiveSlug] = useState<string>(entries[0]?.slug ?? "");
  const [isScrolling, setIsScrolling] = useState(false);

  const { scrollY } = useScroll();

  // Exclusive Magnet State
  const [parkedSlug, setParkedSlug] = useState<string | null>(null);

  // Delayed Pagination State
  const [targetPage, setTargetPage] = useState<number | null>(null);
  const targetPageRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  useEffect(() => {
    targetPageRef.current = targetPage;
  }, [targetPage]);
  const isScrollingRef = useRef(false);
  const parkedSlugRef = useRef<string | null>(null);
  const hasScrolledRef = useRef(false);

  const isProgrammaticScrollRef = useRef(false);
  const scrollEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skipCometVisibilityRef = useRef(false);

  useEffect(() => {
    isScrollingRef.current = isScrolling;
  }, [isScrolling]);
  useEffect(() => {
    parkedSlugRef.current = parkedSlug;
  }, [parkedSlug]);

  useEffect(() => {
    const unsub = scrollY.on("change", (latestY) => {
      if (latestY > 5) hasScrolledRef.current = true;

      if (isProgrammaticScrollRef.current) {
        if (scrollEndTimeoutRef.current)
          clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
          setIsScrolling(false);
        }, 150);
      } else if (parkedSlugRef.current) {
        setParkedSlug(null);
        setShowComet(false);
        skipCometVisibilityRef.current = true;
        setTimeout(() => {
          skipCometVisibilityRef.current = false;
        }, 400);
      }
    });
    return () => {
      unsub();
      if (scrollEndTimeoutRef.current)
        clearTimeout(scrollEndTimeoutRef.current);
    };
  }, [scrollY]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 14;
  const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage));

  const currentEntries = React.useMemo(() => {
    return entries.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );
  }, [entries, currentPage]);

  const paginationItems = React.useMemo(
    () => getPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  useEffect(() => {
    setActiveSlug(currentEntries[0]?.slug ?? "");
  }, [currentEntries]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const changePage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (nextPage === currentPage || targetPage !== null) return;

    if (window.scrollY <= 15) {
      setCurrentPage(nextPage);
      setActiveSlug("");
      setParkedSlug(null);
      return;
    }

    setTargetPage(nextPage);
    setActiveSlug("");
    setParkedSlug(null);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Dynamically track the absolute real-time physics of the browser scroll without dumb timeouts
    let lastY = window.scrollY;
    let stableFrames = 0;

    const watchScroll = () => {
      if (targetPageRef.current === null) return;

      const currentY = window.scrollY;
      if (currentY <= 15) {
        setCurrentPage(targetPageRef.current);
        setTargetPage(null);
        return;
      }

      // Measure sub-pixel stalling
      if (Math.abs(currentY - lastY) < 1) {
        stableFrames++;
        if (stableFrames > 12) {
          // Browser scroll completely paralyzed mid-way! Force UI payload dynamically and snap instantly.
          setCurrentPage(targetPageRef.current);
          setTargetPage(null);
          window.scrollTo({ top: 0, behavior: "instant" });
          return;
        }
      } else {
        stableFrames = 0;
      }

      lastY = currentY;
      scrollRafRef.current = requestAnimationFrame(watchScroll);
    };

    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(watchScroll);
  };

  // Comet state and physics
  const [showComet, setShowComet] = useState(false);
  const [containerTop, setContainerTop] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);

  const rawCometY = useMotionValue(0);
  const springCometY = useSpring(rawCometY, {
    stiffness: SPRING_STIFFNESS,
    damping: SPRING_DAMPING,
    restDelta: 0.001,
  });

  const activeBeamLength = useSpring(0, { stiffness: 250, damping: 35 }); // Overdamped to ban zero-crossing bounce
  const dirSpring = useSpring(1, { stiffness: 400, damping: 40 }); // Critically damped

  const actualDashOffset = useMotionValue(0);
  const actualDashLength = useMotionValue(BEAM_LENGTH);
  const strokeDasharray = useMotionTemplate`${actualDashLength} 1000000`;

  const gradientY1 = useMotionValue(0); // Tail
  const gradientY2 = useMotionValue(0); // Head

  const lastScrollY = useRef(0);
  const scrollDir = useRef(1); // 1 = down, -1 = up

  const parkedIndex = parkedSlug
    ? currentEntries.findIndex((e) => e.slug === parkedSlug)
    : -1;
  const parkedDotY =
    parkedIndex !== -1 && nodeYs.length > 0 ? nodeYs[parkedIndex] : 0;
  const parkedDotYRef = useRef(0);

  // Track geometry memoization (prevent duplicate loops)
  const trackMath = React.useMemo(
    () => buildPath(nodeYs, titleYs, bodyYs),
    [nodeYs, titleYs, bodyYs],
  );
  const nodeYsRef = useRef<number[]>([]);
  const dotLengthsRef = useRef<number[]>([]);

  useEffect(() => {
    parkedDotYRef.current = parkedDotY;
    nodeYsRef.current = nodeYs;
    dotLengthsRef.current = trackMath.dotLengths;
  }, [parkedDotY, nodeYs, trackMath]);

  useAnimationFrame(() => {
    const sy = scrollY.get();

    // Smooth scroll direction derivation
    const delta = sy - lastScrollY.current;
    if (delta > 0) scrollDir.current = 1;
    else if (delta < 0) scrollDir.current = -1;
    lastScrollY.current = sy;

    // 1. Target Head Y calculation
    const vh = typeof window !== "undefined" ? window.innerHeight : 1000;
    const normalTarget = sy + vh * 0.5 - containerTop;
    const firstDot = nodeYs.length > 0 ? nodeYs[0] : 0;

    const THRESHOLD = 250;

    if (isProgrammaticScrollRef.current) {
      // Bind tightly to the expected scroll-padding margin height crossing dynamically on-screen
      rawCometY.set(sy + 156 - containerTop);
    } else if (parkedSlugRef.current && parkedDotYRef.current > 0) {
      // Exclusive Sidebar lock perfectly snapped on target
      rawCometY.set(parkedDotYRef.current);
    } else if (sy < THRESHOLD && nodeYs.length > 0) {
      const progress = sy / THRESHOLD;
      rawCometY.set(firstDot + (normalTarget - firstDot) * progress);
    } else {
      rawCometY.set(normalTarget);
    }

    const hY = springCometY.get();

    // 2. Exact Tail calculation via single derived math (No double springs)
    dirSpring.set(scrollDir.current);
    const rawLen = activeBeamLength.get();
    const len = Math.max(0, rawLen);
    const dir = dirSpring.get();
    const tY = hY - dir * len;

    // 3. Mathematical exact dash offset alignment scaling
    const minY = Math.min(hY, tY);
    const absLen = Math.abs(hY - tY);

    const yList = nodeYsRef.current;
    const lList = dotLengthsRef.current;

    let pathDistance = 0;
    if (yList.length > 0 && lList.length > 0) {
      if (minY <= yList[0]) pathDistance = 0;
      else if (minY >= yList[yList.length - 1]) {
        pathDistance =
          lList[lList.length - 1] + (minY - yList[yList.length - 1]);
      } else {
        for (let i = 0; i < yList.length - 1; i++) {
          if (minY >= yList[i] && minY <= yList[i + 1]) {
            const segY = yList[i + 1] - yList[i];
            const segL = lList[i + 1] - lList[i];
            const progress = segY > 0 ? (minY - yList[i]) / segY : 0;
            pathDistance = lList[i] + progress * segL;
            break;
          }
        }
      }
    }

    actualDashLength.set(absLen);
    actualDashOffset.set(-pathDistance);

    // 4. Gradients map precisely to bounding edges
    gradientY1.set(tY);
    gradientY2.set(hY);
  });

  useEffect(() => {
    // Only control length by scroll movement state, preventing rapid forced clipping when brushing the top boundary
    activeBeamLength.set(showComet ? BEAM_LENGTH : 0);
  }, [showComet, activeBeamLength]);

  const springVelocity = useVelocity(springCometY);
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const unsubscribe = springVelocity.on("change", (v) => {
      if (skipCometVisibilityRef.current) return;
      const isMoving = Math.abs(v) > 5;
      if (isMoving && hasScrolledRef.current) {
        if (!showComet) setShowComet(true);
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          setShowComet(false);
        }, FADE_TIMEOUT_MS);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [springVelocity, showComet]);

  // Measure node Y positions
  useEffect(() => {
    function recalculate() {
      if (!containerRef.current) return;
      const cTop =
        containerRef.current.getBoundingClientRect().top + window.scrollY;
      setContainerTop(cTop);
      const ys: number[] = [];
      const tYs: number[] = [];
      const bYs: number[] = [];
      let maxY = 0;

      currentEntries.forEach((_, i) => {
        const nodeEl = nodeRefs.current[i];
        const titleEl = titleRefs.current[i];
        const bodyEl = bodyRefs.current[i];

        let y = 0;
        if (nodeEl) {
          const rect = nodeEl.getBoundingClientRect();
          y = rect.top + window.scrollY - cTop + rect.height / 2;
          ys.push(y);
          maxY = Math.max(maxY, y);
        }

        if (titleEl) {
          const rect = titleEl.getBoundingClientRect();
          const tY = rect.bottom + window.scrollY - cTop;
          tYs.push(tY);
        } else {
          tYs.push(y + 30);
        }

        if (bodyEl) {
          const rect = bodyEl.getBoundingClientRect();
          const bY = rect.bottom + window.scrollY - cTop;
          bYs.push(bY);
          maxY = Math.max(maxY, bY);
        } else {
          bYs.push(y + 100);
        }
      });

      setNodeYs(ys);
      setTitleYs(tYs);
      setBodyYs(bYs);
      setSvgHeight(maxY + 60);
    }
    recalculate();
    const ro = new ResizeObserver(recalculate);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [currentEntries]);

  // Track active section via IntersectionObserver
  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (observed) => {
        if (isScrolling) return;
        observed.forEach((e) => {
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
          else visible.delete(e.target.id);
        });
        if (visible.size > 0) {
          let best = "";
          let bestRatio = 0;
          visible.forEach((ratio, id) => {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              best = id;
            }
          });
          if (best) setActiveSlug(best);
        }
      },
      { rootMargin: "-120px 0px -66% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    currentEntries.forEach(({ slug }) => {
      const el = document.getElementById(slug);
      if (el) observer.observe(el);
    });
    return () => {
      observer.disconnect();
      visible.clear();
    };
  }, [currentEntries, isScrolling]);

  const scrollToEntry = (slug: string) => {
    const el = document.getElementById(slug);
    if (!el) return;
    setIsScrolling(true);
    setParkedSlug(slug);
    setActiveSlug(slug);

    isProgrammaticScrollRef.current = true;
    if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);

    const offset = el.getBoundingClientRect().top + window.scrollY - 140;
    window.scrollTo({ top: offset, behavior: "smooth" });

    scrollEndTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      setIsScrolling(false);
    }, 150);
  };

  const d = trackMath.d;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Mobile version nav - BEFORE pt-24 so it's at y~0 and immediately sticky at top-16 (flush under navbar) */}
      <div className="lg:hidden sticky top-16 z-40 bg-background/95 backdrop-blur border-t border-b border-border/50 relative">
        <MobileVersionNav
          entries={currentEntries}
          activeSlug={activeSlug}
          onSelect={scrollToEntry}
        />
      </div>

      <div className="relative flex-1 pt-16 md:pt-24">
        <RegMark position="top-left" />
        <RegMark position="top-right" />

        {/* Breadcrumb */}
        <FadeIn
          delay={0.1}
          className="container max-w-7xl px-4 md:px-6 py-4 border-b border-border/50"
        >
          <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Changelog</span>
          </div>
        </FadeIn>

        {/* Grid */}
        <div className="container max-w-7xl px-4 md:px-6 py-6 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12 relative">
            <div className="hidden lg:block absolute left-[calc(100%-280px-1.5rem)] top-0 bottom-0 w-px bg-border/30" />

            {/* Left column */}
            <SlideUp delay={0.2} yOffset={20}>
              {/* Title block - matches LegalLayout */}
              <div className="mb-6 pb-6 md:mb-8 md:pb-8 border-b border-border/50">
                <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-4">
                  Changelog
                </h1>
                <p className="text-sm font-mono text-muted-foreground">
                  Every notable change to Envault, from the initial commit to
                  the present day.
                </p>
              </div>

              {/* Timeline */}
              <div ref={containerRef} className="relative">
                {/* Circuit SVG - desktop only */}
                <svg
                  className="hidden md:block absolute top-0 pointer-events-none select-none overflow-visible"
                  style={{ left: "5.5rem" }}
                  width={SVG_W}
                  height={svgHeight}
                  aria-hidden="true"
                >
                  {nodeYs.length >= 2 && (
                    <>
                      <defs>
                        <motion.linearGradient
                          id="comet-gradient"
                          gradientUnits="userSpaceOnUse"
                          x1="0"
                          x2="0"
                          y1={gradientY1}
                          y2={gradientY2}
                        >
                          <stop
                            offset="0%"
                            stopColor="hsl(var(--muted-foreground))"
                            stopOpacity="0"
                          />
                          <stop
                            offset="100%"
                            stopColor="hsl(var(--foreground))"
                            stopOpacity="1"
                          />
                        </motion.linearGradient>
                      </defs>
                      <path
                        d={d}
                        stroke="hsl(var(--border))"
                        strokeWidth="1"
                        strokeOpacity={0.5}
                        fill="none"
                        strokeLinecap="round"
                      />
                      <motion.path
                        ref={pathRef}
                        d={d}
                        stroke="url(#comet-gradient)"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        style={{
                          strokeDasharray,
                          strokeDashoffset: actualDashOffset,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: showComet ? 1 : 0 }}
                        transition={{
                          opacity: {
                            duration: FADE_DURATION_S,
                            delay: showComet ? 0 : 0.4,
                          },
                        }}
                      />
                    </>
                  )}
                  {nodeYs.map((y, i) => (
                    <g key={i}>
                      <circle
                        cx={CX}
                        cy={y}
                        r={4}
                        fill="hsl(var(--background))"
                        stroke="hsl(var(--border))"
                        strokeWidth="1"
                        strokeOpacity={0.6}
                      />
                      <circle
                        cx={CX}
                        cy={y}
                        r={1.5}
                        fill="hsl(var(--primary))"
                        fillOpacity={0.8}
                      />
                    </g>
                  ))}
                </svg>

                {/* Entries */}
                {currentEntries.map((entry, index) => {
                  const displayTitle =
                    entry.title || `Release v${entry.version}`;
                  const hasLongTitle = displayTitle.length > 25;

                  return (
                    <div
                      key={entry.slug}
                      id={entry.slug}
                      className={cn(
                        "scroll-mt-36",
                        index < currentEntries.length - 1
                          ? "pb-12 md:pb-16"
                          : "pb-4",
                      )}
                    >
                      {/* Desktop: side-by-side with date column + SVG spacer */}
                      <div className="hidden md:flex gap-0">
                        {/* Date */}
                        <div className="w-28 shrink-0 flex items-start justify-end pr-6 pt-0.5">
                          <div
                            ref={(el) => {
                              nodeRefs.current[index] = el;
                            }}
                          >
                            <span className="text-xs font-mono text-muted-foreground/60 whitespace-nowrap">
                              {entry.date}
                            </span>
                          </div>
                        </div>
                        {/* SVG spacer */}
                        <div className="w-10 shrink-0" />
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={cn(
                                "text-xs font-mono tracking-widest uppercase px-2 py-0.5 rounded-full",
                                getBadgeStyle(entry.category),
                              )}
                            >
                              {entry.category}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground/50">
                              v{entry.version}
                            </span>
                          </div>
                          <h3
                            ref={(el) => {
                              titleRefs.current[index] = el;
                            }}
                            className={cn(
                              "font-semibold tracking-tight text-foreground mb-4",
                              hasLongTitle
                                ? "text-xl md:text-2xl"
                                : "text-lg md:text-xl",
                            )}
                          >
                            {renderInlineMarkdown(
                              displayTitle.replace(/^###\s*/, ""),
                              `title-${entry.version}`,
                            )}
                          </h3>
                          <div
                            ref={(el) => {
                              bodyRefs.current[index] = el;
                            }}
                          >
                            <MDXRemote
                              {...entry.bodyMdx}
                              components={changelogMdxComponents}
                            />
                          </div>
                          {entry.authors.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-border/30 flex items-center gap-4 flex-wrap">
                              {entry.authors.map((author) => (
                                <AuthorChip
                                  key={author.github}
                                  author={author}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Mobile: stacked layout, no circuit SVG */}
                      <div className="md:hidden">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-mono text-muted-foreground/50">
                            {entry.date}
                          </span>
                          <span className="text-muted-foreground/30">
                            <Dot className="w-3 h-3" />
                          </span>
                          <span
                            className={cn(
                              "text-xs font-mono tracking-widest uppercase px-2 py-0.5 rounded-full",
                              getBadgeStyle(entry.category),
                            )}
                          >
                            {entry.category}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground/50">
                            v{entry.version}
                          </span>
                        </div>
                        <h3
                          className={cn(
                            "font-semibold tracking-tight text-foreground mb-4",
                            hasLongTitle ? "text-xl" : "text-lg",
                          )}
                        >
                          {renderInlineMarkdown(
                            displayTitle.replace(/^###\s*/, ""),
                            `mobile-title-${entry.version}`,
                          )}
                        </h3>
                        <div>
                          <MDXRemote
                            {...entry.bodyMdx}
                            components={changelogMdxComponents}
                          />
                        </div>
                        {entry.authors.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border/30 flex items-center gap-4 flex-wrap">
                            {entry.authors.map((author) => (
                              <AuthorChip key={author.github} author={author} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="border-t border-border/50 pt-8 pb-4">
                  <nav
                    aria-label="Changelog pagination"
                    className="flex w-full items-center justify-between"
                  >
                    <div className="flex flex-1 justify-start">
                      <button
                        onClick={() => changePage(currentPage - 1)}
                        disabled={currentPage === 1 || targetPage !== null}
                        aria-label="Go to previous page"
                        className="flex items-center gap-1.5 sm:gap-2 pr-4 py-2 text-xs sm:text-sm font-mono text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">Prev</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-2 sm:gap-5">
                      {paginationItems.map((item, index) =>
                        item === "ellipsis" ? (
                          <span
                            key={`ellipsis-${index}`}
                            className="flex h-6 min-w-4 items-center justify-center text-[10px] font-mono text-muted-foreground/60 sm:h-7 sm:min-w-5 sm:text-[11px]"
                            aria-hidden="true"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => changePage(item as number)}
                            disabled={targetPage !== null}
                            aria-label={`Go to page ${item}`}
                            aria-current={
                              currentPage === item ? "page" : undefined
                            }
                            className={cn(
                              "inline-flex h-6 min-w-7 items-center justify-center rounded-full px-2 text-[10px] font-mono transition-colors sm:h-7 sm:min-w-9 sm:px-3 sm:text-[11px] cursor-pointer disabled:cursor-not-allowed",
                              currentPage === item
                                ? "bg-foreground text-background"
                                : "text-foreground/90 hover:bg-accent/30 hover:text-foreground",
                            )}
                          >
                            {item}
                          </button>
                        ),
                      )}

                      <span
                        className="text-[10px] font-mono text-muted-foreground/60 md:inline sm:text-[11px]"
                        aria-hidden="true"
                      >
                        /
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground/60 md:inline sm:text-[11px]">
                        {totalPages}
                      </span>
                    </div>

                    <div className="flex flex-1 justify-end">
                      <button
                        onClick={() => changePage(currentPage + 1)}
                        disabled={
                          currentPage === totalPages || targetPage !== null
                        }
                        aria-label="Go to next page"
                        className="flex items-center gap-1.5 sm:gap-2 pl-4 py-2 text-xs sm:text-sm font-mono text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <span className="sm:hidden">Next</span>
                        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </nav>
                </div>
              )}
            </SlideUp>

            {/* Sidebar */}
            <SlideUp delay={0.3} yOffset={20} className="hidden lg:block">
              <div className="sticky top-28 space-y-4">
                <div className="pb-4 border-b border-border/50">
                  <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-muted-foreground">
                    Releases
                  </h2>
                </div>

                <nav className="space-y-1">
                  {currentEntries.map((entry) => {
                    const isActive = activeSlug === entry.slug;
                    return (
                      <button
                        key={entry.slug}
                        onClick={() => scrollToEntry(entry.slug)}
                        className={cn(
                          "w-full text-left text-sm transition-all duration-200 hover:text-foreground group relative py-2 px-3 rounded-md cursor-pointer",
                          isActive
                            ? "text-foreground bg-accent/50 font-medium"
                            : "text-muted-foreground hover:bg-accent/30",
                        )}
                      >
                        <span className="font-mono leading-relaxed">
                          v{entry.version}
                        </span>
                        {isActive && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "2rem", opacity: 1 }}
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 bg-primary rounded-full"
                          />
                        )}
                      </button>
                    );
                  })}
                </nav>

                {/* Grid Intersection Accent */}
                <div className="pt-8 mt-8 border-t border-border/30">
                  <div className="w-4 h-4 rounded-full border border-border/50 mx-auto opacity-30" />
                </div>
              </div>
            </SlideUp>
          </div>
        </div>

        <RegMark position="bottom-left" />
        <RegMark position="bottom-right" />

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { SceneContent } from "./Scene";

export function GlobalScene() {
  const pathname = usePathname();
  const [scrollOpacity, setScrollOpacity] = useState(1);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const animTimer = setTimeout(() => setIsAnimating(false), 2000);
    return () => {
      clearTimeout(animTimer);
    };
  }, []);

  const isAuthPage =
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/register") ||
    pathname?.startsWith("/forgot-password") ||
    pathname?.startsWith("/auth/complete-profile") ||
    pathname?.startsWith("/auth/update-password") ||
    pathname?.startsWith("/auth/device") ||
    pathname?.startsWith("/transfer") ||
    pathname?.startsWith("/approve") ||
    pathname?.startsWith("/join");
  const isLandingPage = pathname === "/";

  useEffect(() => {
    if (!isLandingPage) return;

    // Only fade on scroll for the landing page
    const handleScroll = () => {
      const heroHeight = window.innerHeight;
      const scrollY = window.scrollY;
      const newOpacity = Math.max(0, 1 - (scrollY / heroHeight) * 1.5);
      setScrollOpacity(newOpacity);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLandingPage]);

  if (!isAuthPage && !isLandingPage) return null;

  const finalOpacity = isLandingPage ? scrollOpacity : 1;

  const baseLayout = isAuthPage
    ? "fixed inset-y-0 left-0 w-1/2 hidden sm:block pointer-events-none z-0 overflow-hidden"
    : "fixed inset-y-0 right-0 w-1/2 hidden sm:block pointer-events-none z-0 overflow-hidden";
  const layoutClass = `${baseLayout} ${isAnimating ? "transition-opacity duration-1000 ease-in-out" : ""}`;

  return (
    <div
      className={layoutClass.trim() + " auth-scene-transition"}
      style={{ opacity: finalOpacity }}
    >
      <Canvas
        dpr={[1, 1.25]}
        fallback={<div className="h-full w-full" />}
        gl={{
          antialias: false,
          preserveDrawingBuffer: false,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: true,
        }}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
}

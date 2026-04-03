// Copyright (c) 2026 Dinanath (dinanath.dev). All rights reserved.
// Licensed under the Functional Source License, Version 1.1-MIT. See LICENSE file in the project root for full license information.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifyHmacSignature } from "@/lib/utils/hmac";
import { shouldShowBanner } from "@/lib/system/banner-routes";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const method = request.method.toUpperCase();
  const authHeader = request.headers.get("authorization") || "";
  const hasBearerAuth = authHeader.startsWith("Bearer ");

  // OAuth fallback: if provider lands on "/" with code, route through our
  // dedicated callback handler so session exchange always completes.
  if (pathname === "/" && searchParams.get("code")) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

  const matchesRoute = (path: string, route: string) => {
    if (route === "/") return path === "/";
    return path === route || path.startsWith(`${route}/`);
  };

  // Bypass middleware for static files and images immediately
  if (
    pathname.startsWith("/_next") ||
    pathname.includes("/static") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  const isCliApiRoute = matchesRoute(pathname, "/api/cli");
  const isSdkApiRoute = matchesRoute(pathname, "/api/sdk");
  const isTransferApiRoute =
    /^\/api\/projects\/[^/]+\/transfer\/(initiate|accept|reject)$/.test(
      pathname,
    );

  // Explicit unauthenticated API allowlist.
  const unauthenticatedApiRoutes = [
    "/api/system-status",
    "/api/cli-version",
    "/api/search",
    "/api/docs/markdown",
    "/api/avatar",
    "/api/cli/auth/device/code",
    "/api/cli/auth/device/token",
    "/api/cli/auth/device/cancel",
    "/api/cli/auth/refresh",
    "/api/cron/digest",
    "/api/auth/webauthn/authenticate/options",
    "/api/auth/webauthn/authenticate/verify",
    "/api/github/callback",
    "/api/github/webhook",
    "/api/og",
  ];

  const isPublicApi = unauthenticatedApiRoutes.some((route) =>
    matchesRoute(pathname, route),
  );
  const isCliBearerRequest = isCliApiRoute && hasBearerAuth;
  const isSdkBearerRequest = isSdkApiRoute && authHeader.startsWith("Bearer envault_agt_");
  const isApproveMutation = pathname.startsWith("/api/approve/");
  const isSdkAuthDelegate = pathname === "/api/sdk/auth/delegate";

  // HMAC Verification for mutations
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
    !isPublicApi &&
    !isCliBearerRequest &&
    !isSdkBearerRequest &&
    !isApproveMutation &&
    !isTransferApiRoute &&
    !isSdkAuthDelegate
  ) {
    const signature = request.headers.get("x-signature");
    const timestampStr = request.headers.get("x-timestamp");
    const secret =
      process.env.NEXT_PUBLIC_API_SIGNATURE_SALT ||
      "default_dev_secret_so_it_works";

    if (!signature || !timestampStr) {
      return NextResponse.json(
        { error: "Missing required HMAC headers (X-Signature, X-Timestamp)" },
        { status: 403 },
      );
    }

    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();

    // Replay protection: Reject if older than 30 seconds
    if (isNaN(timestamp) || now - timestamp > 30000) {
      return NextResponse.json(
        { error: "Request expired (Replay Protection enabled)" },
        { status: 403 },
      );
    }

    let payload = "";
    try {
      const clonedRequest = request.clone();
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await clonedRequest.formData();
        payload = new URLSearchParams(
          formData as unknown as Record<string, string>,
        ).toString();
      } else if (contentType.includes("multipart/form-data")) {
        payload = "";
      } else {
        payload = await clonedRequest.text();
      }
    } catch {
      payload = "";
    }

    const isValid = await verifyHmacSignature(
      payload,
      timestampStr,
      signature,
      secret,
    );

    if (!isValid) {
      const isFallbackValid = await verifyHmacSignature(
        "",
        timestampStr,
        signature,
        secret,
      );

      if (!isFallbackValid) {
        return NextResponse.json(
          { error: "Invalid HMAC signature" },
          { status: 403 },
        );
      }
    }
  }

  // Define protected routes
  const protectedRoutes = [
    "/dashboard",
    "/settings",
    "/project",
    "/notifications",
    "/approve",
    "/admin",
    "/access",
  ];

  const isProtectedRoute = protectedRoutes.some((route) =>
    matchesRoute(pathname, route),
  );

  // Define public routes that don't require auth
  const publicRoutes = [
    "/",
    "/login",
    "/forgot-password",
    "/join",
    "/privacy",
    "/terms",
    "/auth",
    "/docs",
    "/status",
    "/robots.txt",
    "/sitemap.xml",
  ];

  const isPublicRoute = publicRoutes.some((route) =>
    matchesRoute(pathname, route),
  );

  // Dynamic [handle]/[slug] routes (e.g. /username/project-slug) need session refreshed
  // so Supabase realtime and server components can authenticate
  const isDynamicHandleRoute =
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    /^\/[^/]+\/[^/]+$/.test(pathname) &&
    !isPublicRoute &&
    !isProtectedRoute;

  // Performance optimization: Only refresh session for known routes.
  // For unknown routes (404s), skipping getUser saves ~200ms.
  // We also skip if we know it's a static file (already handled above).
  const shouldRefreshSession =
    isProtectedRoute ||
    isPublicRoute ||
    isDynamicHandleRoute ||
    (pathname.startsWith("/api") && !isPublicApi && !isCliBearerRequest && !isSdkBearerRequest);

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let user = null;

  if (shouldRefreshSession) {
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();
    user = supabaseUser ?? null;
  }

  // If it's a protected route and user is not authenticated, redirect to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // If user is authenticated and trying to access login page, redirect to dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // For API routes, protect all except public ones
  if (
    pathname.startsWith("/api") &&
    !isPublicApi &&
    !isCliBearerRequest &&
    !isSdkBearerRequest &&
    !isSdkAuthDelegate &&
    !user
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Inject banner visibility hint - read by the root layout (server-side).
  supabaseResponse.headers.set(
    "x-show-status-banner",
    shouldShowBanner(pathname) ? "1" : "0",
  );

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp)$).*)",
  ],
};

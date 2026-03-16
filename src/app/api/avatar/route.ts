import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { avatarProxyRateLimit } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";

const CACHE_TTL_SECONDS = 60 * 60 * 6;
const ALLOWED_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "avatars.githubusercontent.com",
  "secure.gravatar.com",
]);

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const firstIp = forwardedFor.split(",")[0]?.trim();
  return firstIp || "unknown";
}

function isAllowedAvatarUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return false;
    }

    if (ALLOWED_HOSTS.has(url.hostname)) {
      return true;
    }

    // Allow any subdomain of googleusercontent.com used by Google profile photos.
    return url.hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

function cacheKeyFor(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex");
  return `avatar:proxy:${hash}`;
}

function invalidRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const avatarUrl = request.nextUrl.searchParams.get("url") || "";

  if (!avatarUrl) {
    return invalidRequest("Missing avatar URL");
  }

  if (avatarUrl.length > 2048) {
    return invalidRequest("Avatar URL is too long");
  }

  if (!isAllowedAvatarUrl(avatarUrl)) {
    return invalidRequest("Avatar URL host is not allowed");
  }

  const ip = getClientIp(request);
  const { success } = await avatarProxyRateLimit.limit(`avatar_proxy_${ip}`);
  if (!success) {
    return NextResponse.json(
      { error: "Too many avatar requests. Please try again shortly." },
      { status: 429 },
    );
  }

  const key = cacheKeyFor(avatarUrl);

  try {
    const [cachedBody, cachedType] = await Promise.all([
      redis.get<string>(`${key}:body`),
      redis.get<string>(`${key}:type`),
    ]);

    if (cachedBody && cachedType) {
      const bodyBuffer = Buffer.from(cachedBody, "base64");
      return new NextResponse(bodyBuffer, {
        status: 200,
        headers: {
          "Content-Type": cachedType,
          "Cache-Control":
            "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
          "X-Avatar-Cache": "hit",
        },
      });
    }
  } catch {
    // Continue to upstream fetch if Redis is temporarily unavailable.
  }

  const upstream = await fetch(avatarUrl, {
    headers: {
      "User-Agent": "EnvaultAvatarProxy/1.0",
      Accept: "image/*,*/*;q=0.8",
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Failed to fetch avatar from upstream" },
      { status: upstream.status },
    );
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  const bodyArrayBuffer = await upstream.arrayBuffer();
  const bodyBuffer = Buffer.from(bodyArrayBuffer);

  if (bodyBuffer.length > 1024 * 1024) {
    return NextResponse.json(
      { error: "Avatar file too large" },
      { status: 413 },
    );
  }

  try {
    await Promise.all([
      redis.set(`${key}:body`, bodyBuffer.toString("base64"), {
        ex: CACHE_TTL_SECONDS,
      }),
      redis.set(`${key}:type`, contentType, { ex: CACHE_TTL_SECONDS }),
    ]);
  } catch {
    // Caching failures should not block the avatar response.
  }

  return new NextResponse(bodyBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control":
        "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
      "X-Avatar-Cache": "miss",
    },
  });
}

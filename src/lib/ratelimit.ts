import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "./redis";

// Allow 5 requests per 1 minute for Auth operations (Sign-in/up/reset)
export const authRateLimit = new Ratelimit({
  redis: getRedisClient(),
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit/auth",
});

// Allow 20 requests per 10 seconds for general API reads
export const apiRateLimit = new Ratelimit({
  redis: getRedisClient(),
  limiter: Ratelimit.slidingWindow(20, "10 s"),
  analytics: true,
  prefix: "@upstash/ratelimit/api",
});

// Allow 60 requests per 1 minute for general CLI reads from humans
export const humanApiLimit = new Ratelimit({
  redis: getRedisClient(),
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit/api_human",
});

// Allow 600 requests per 1 minute for machines (CI/CD)
export const machineApiLimit = new Ratelimit({
  redis: getRedisClient(),
  limiter: Ratelimit.slidingWindow(600, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit/api_machine",
});

// Allow 10 requests per 1 minute for write operations (POST/PUT/DELETE)
export const writeRateLimit = new Ratelimit({
  redis: getRedisClient(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit/write",
});

// Audit read: 20/min
export const auditReadRateLimit = new Ratelimit({
  redis: getRedisClient(),
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit/audit_read",
});

// Audit write: high limit, block identical spam (60/min per actor)
export const auditWriteRateLimit = new Ratelimit({
  redis: getRedisClient(),
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit/audit_write",
});

// Avatar proxy: generous read limit to protect upstream providers from burst fetches
export const avatarProxyRateLimit = new Ratelimit({
  redis: getRedisClient(),
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit/avatar_proxy",
});

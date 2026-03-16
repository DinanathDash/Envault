export function sanitizeUsernameCandidate(value?: string | null): string {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return "";

  return raw
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

export function inferUsernameFromAuth(
  email?: string | null,
  metadata?: Record<string, unknown> | null,
): string {
  const meta = metadata || {};
  const candidates = [
    typeof meta.username === "string" ? meta.username : "",
    typeof meta.preferred_username === "string" ? meta.preferred_username : "",
    typeof meta.user_name === "string" ? meta.user_name : "",
    typeof meta.login === "string" ? meta.login : "",
    email ? email.split("@")[0] : "",
    typeof meta.name === "string" ? meta.name : "",
    typeof meta.full_name === "string" ? meta.full_name : "",
  ];

  for (const candidate of candidates) {
    const sanitized = sanitizeUsernameCandidate(candidate);
    if (sanitized) return sanitized;
  }

  return "user";
}

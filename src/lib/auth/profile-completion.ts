import type { User } from "@supabase/supabase-js";

export function isProfileComplete(
  user: User | null,
  profileUsername?: string | null,
  onboardingCompletedAt?: string | null,
): boolean {
  if (!user) return false;

  // Primary signal: explicit onboarding completion timestamp.
  if (
    typeof onboardingCompletedAt === "string" &&
    onboardingCompletedAt.trim().length > 0
  ) {
    return true;
  }

  // Backward-compatible fallback for existing users created before
  // onboarding_completed_at was introduced.
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const firstName =
    typeof meta.first_name === "string" ? meta.first_name.trim() : "";
  const lastName =
    typeof meta.last_name === "string" ? meta.last_name.trim() : "";
  const username =
    typeof profileUsername === "string" ? profileUsername.trim() : "";

  return firstName.length > 0 && lastName.length > 0 && username.length > 0;
}

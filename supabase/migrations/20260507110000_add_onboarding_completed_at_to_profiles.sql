ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_onboarding_completed_at_idx
  ON public.profiles (onboarding_completed_at)
  WHERE onboarding_completed_at IS NOT NULL;

-- Backfill existing users who already have required profile details.
UPDATE public.profiles AS p
SET onboarding_completed_at = COALESCE(p.updated_at, p.created_at, NOW())
FROM auth.users AS u
WHERE p.id = u.id
  AND p.onboarding_completed_at IS NULL
  AND NULLIF(BTRIM(COALESCE(p.username, '')), '') IS NOT NULL
  AND NULLIF(BTRIM(COALESCE(u.raw_user_meta_data->>'first_name', '')), '') IS NOT NULL
  AND NULLIF(BTRIM(COALESCE(u.raw_user_meta_data->>'last_name', '')), '') IS NOT NULL;

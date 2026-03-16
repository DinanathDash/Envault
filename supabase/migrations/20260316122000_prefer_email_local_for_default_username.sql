-- Align DB-side default username inference with app behavior.
-- Prefer stable handle-like sources first, then email local-part,
-- and only then free-form display names.

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  extracted_username TEXT;
  base_username TEXT;
  suffix INTEGER := 1;
BEGIN
  extracted_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_username'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'user_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'login'), ''),
    NULLIF(TRIM(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    'user'
  );

  base_username := LOWER(
    REGEXP_REPLACE(extracted_username, '[^a-zA-Z0-9_-]+', '-', 'g')
  );
  base_username := REGEXP_REPLACE(base_username, '^[-_]+|[-_]+$', '', 'g');
  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  extracted_username := base_username;

  WHILE EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE LOWER(p.username) = LOWER(extracted_username)
      AND p.id <> NEW.id
  ) LOOP
    extracted_username := base_username || '-' || suffix;
    suffix := suffix + 1;
  END LOOP;

  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    extracted_username,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = CASE
      WHEN public.profiles.username IS NULL OR public.profiles.username = ''
        THEN EXCLUDED.username
      ELSE public.profiles.username
    END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();

  INSERT INTO public.notification_preferences (
    user_id,
    email_access_requests, email_access_granted,
    email_device_activity, email_security_alerts,
    email_project_activity, email_cli_activity, email_system_updates,
    app_access_requests,  app_access_granted,
    app_device_activity,  app_security_alerts,
    app_project_activity, app_cli_activity, app_system_updates,
    digest_frequency
  ) VALUES (
    NEW.id,
    TRUE,  TRUE,
    TRUE,  FALSE,
    FALSE, FALSE, FALSE,
    TRUE,  TRUE,
    TRUE,  TRUE,
    TRUE,  TRUE, TRUE,
    'none'
  ) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

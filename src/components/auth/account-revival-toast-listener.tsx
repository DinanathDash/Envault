"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { triggerHaptic } from "@/lib/utils/haptic";

const REVIVAL_TOAST_WINDOW_MS = 15 * 1000;

export function AccountRevivalToastListener() {
  useEffect(() => {
    const supabase = createClient();

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event !== "SIGNED_IN" || !session?.user?.id) {
          return;
        }

        void (async () => {
          const userId = session.user.id;
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("last_revived_at")
            .eq("id", userId)
            .maybeSingle();

          if (error || !profile?.last_revived_at) {
            return;
          }

          const revivedAtMs = new Date(profile.last_revived_at).getTime();
          if (!Number.isFinite(revivedAtMs)) {
            return;
          }

          if (Date.now() - revivedAtMs > REVIVAL_TOAST_WINDOW_MS) {
            return;
          }

          const dedupeKey = `revival-toast:${userId}:${profile.last_revived_at}`;
          if (sessionStorage.getItem(dedupeKey) === "1") {
            return;
          }

          sessionStorage.setItem(dedupeKey, "1");
          triggerHaptic("success");
          toast.success(
            "Welcome back! Your account deletion request has been cancelled.",
          );
        })();
      },
    );

    return () => {
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  return null;
}

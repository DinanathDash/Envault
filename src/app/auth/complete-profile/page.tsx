import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { createClient } from "@/lib/supabase/server";
import { ProfileCompleteForm } from "./profile-complete-form";
import { isProfileComplete } from "@/lib/auth/profile-completion";

export const metadata: Metadata = {
  title: "Complete Profile",
  description: "Complete your Envault profile before accessing your dashboard.",
  openGraph: {
    siteName: "Envault",
    images: ["/open-graph/Login%20OG.png"],
  },
};

export default async function CompleteProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (
    isProfileComplete(user, profile?.username, profile?.onboarding_completed_at)
  ) {
    redirect("/dashboard");
  }

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const firstName =
    typeof meta.first_name === "string" ? meta.first_name.trim() : "";
  const lastName =
    typeof meta.last_name === "string" ? meta.last_name.trim() : "";
  const username =
    typeof profile?.username === "string" ? profile.username : "";

  return (
    <AuthLayout>
      <ProfileCompleteForm
        initialFirstName={firstName}
        initialLastName={lastName}
        initialUsername={username}
      />
    </AuthLayout>
  );
}

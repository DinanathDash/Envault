import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isProfileComplete } from "@/lib/auth/profile-completion";

export const metadata: Metadata = {
  title: "Login",
  description:
    "Sign in to your Envault account to access your secure environment variables.",
  openGraph: {
    siteName: "Envault",
    images: ["/open-graph/Login%20OG.png"],
  },
};

export default async function LoginPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const next =
    typeof searchParams.next === "string" ? searchParams.next : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();
    const completed = isProfileComplete(
      user,
      profile?.username,
      profile?.onboarding_completed_at,
    );

    if (next && next.startsWith("/")) {
      if (completed) {
        redirect(next);
      }
      redirect(`/auth/complete-profile?next=${encodeURIComponent(next)}`);
    }
    if (!completed) {
      redirect("/auth/complete-profile");
    }
    redirect("/dashboard");
  }

  return (
    <AuthLayout>
      <AuthForm />
    </AuthLayout>
  );
}

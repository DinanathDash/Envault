import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const EMAIL_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  if (!value) return false;
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType);
}

function resolveAuthBaseUrl(request: Request, origin: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (process.env.NODE_ENV !== "development" && forwardedHost) {
    return `https://${forwardedHost}`;
  }

  return origin.replace(/\/+$/, "");
}

function normalizeNextPath(next: string | null): string {
  // Reject null, non-slash-prefixed, and protocol-relative URLs (//evil.com).
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
  const otpType = searchParams.get("type");
  const authProvider = searchParams.get("authProvider");
  // if "next" is in param, use it as the redirect URL
  const next = normalizeNextPath(searchParams.get("next"));
  const baseUrl = resolveAuthBaseUrl(request, origin);
  const redirectTo = (path: string) => `${baseUrl}${path}`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(redirectTo(next));
      if (authProvider === "google" || authProvider === "github") {
        response.cookies.set("envault_last_used_auth_provider", authProvider, {
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 365,
        });
      }
      return response;
    }
  }

  if (tokenHash && isEmailOtpType(otpType)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    if (!error) {
      return NextResponse.redirect(redirectTo(next));
    }
  }

  return NextResponse.redirect(
    redirectTo("/login?authError=invalid_or_expired"),
  );
}

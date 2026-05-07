"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Loader2,
  Lock,
  Command,
  Fingerprint,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  signInWithGoogle,
  signInWithGithub,
  signInWithPassword,
  signUp,
} from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { triggerHaptic } from "@/lib/utils/haptic";
import { Kbd } from "@/components/ui/kbd";
import { CornerDownLeft } from "lucide-react";
import {
  pushWithTransition,
  replaceWithTransition,
} from "@/lib/utils/view-transition-navigation";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type AuthValues = z.infer<typeof authSchema>;
type AuthProvider = "google" | "github" | "passkey";

const LAST_USED_AUTH_PROVIDER_KEY = "envault:last_used_auth_provider";
const LAST_USED_AUTH_PROVIDER_COOKIE = "envault_last_used_auth_provider";

function toAuthProvider(value: string | null | undefined): AuthProvider | null {
  if (value === "google" || value === "github" || value === "passkey") {
    return value;
  }
  return null;
}

const ModKey = () => (
  <>
    <span className="non-mac-only">Ctrl</span>
    <Command className="w-3 h-3 mac-only" />
  </>
);

const LastUsedBadge = () => (
  <span className="pointer-events-none absolute right-2 top-0 z-20 inline-flex h-5 -translate-y-1/2 select-none items-center whitespace-nowrap rounded-full border border-input bg-background px-3 text-[10px] font-semibold leading-none tracking-[0.14em] text-foreground/80">
    LAST USED
  </span>
);

export function AuthForm() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("login");
  const [signupSuccess, setSignupSuccess] = React.useState(false);
  const [signupEmail, setSignupEmail] = React.useState("");
  const [signupExistingLink, setSignupExistingLink] = React.useState(false);
  const [signupTimeLeft, setSignupTimeLeft] = React.useState<number | null>(
    null,
  );
  const [emailConfirmed, setEmailConfirmed] = React.useState(false);
  const [passwordUpdated, setPasswordUpdated] = React.useState(false);
  const [deletionScheduled, setDeletionScheduled] = React.useState(false);
  const [accountDeleted, setAccountDeleted] = React.useState(false);
  const [authExpired, setAuthExpired] = React.useState(false);
  // Inline notice for login errors that require user action (e.g. "check inbox")
  const [loginNotice, setLoginNotice] = React.useState<string | null>(null);
  const [lastUsedProvider, setLastUsedProvider] =
    React.useState<AuthProvider | null>(() => {
      // Lazy initializer runs once on the client — no effect needed.
      try {
        const cookieValue = toAuthProvider(
          document.cookie
            .split("; ")
            .find((row) => row.startsWith(`${LAST_USED_AUTH_PROVIDER_COOKIE}=`))
            ?.split("=")[1],
        );
        const savedFromStorage = toAuthProvider(
          window.localStorage.getItem(LAST_USED_AUTH_PROVIDER_KEY),
        );
        // OAuth callback writes cookie after successful auth. Prefer it over stale local storage.
        const savedProvider = cookieValue || savedFromStorage;
        if (savedProvider && savedFromStorage !== savedProvider) {
          window.localStorage.setItem(
            LAST_USED_AUTH_PROVIDER_KEY,
            savedProvider,
          );
        }
        return savedProvider ?? null;
      } catch {
        // Ignore storage access errors (private mode, blocked storage, etc).
        return null;
      }
    });
  const router = useRouter();

  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (searchParams.get("accountDeletionScheduled")) {
      triggerHaptic("cancel");
      setDeletionScheduled(true);
      replaceWithTransition(router, "/login");
    }
    if (searchParams.get("accountDeleted")) {
      setAccountDeleted(true);
      replaceWithTransition(router, "/login");
    }
    if (searchParams.get("emailConfirmed")) {
      setEmailConfirmed(true);
      replaceWithTransition(router, "/login");
    }
    if (searchParams.get("passwordUpdated")) {
      setPasswordUpdated(true);
      replaceWithTransition(router, "/login");
    }
    if (searchParams.get("authError") === "invalid_or_expired") {
      triggerHaptic("cancel");
      setAuthExpired(true);
      replaceWithTransition(router, "/login");
    }
  }, [searchParams, router]);

  const rememberLastUsedProvider = React.useCallback(
    (provider: AuthProvider) => {
      setLastUsedProvider(provider);
      try {
        window.localStorage.setItem(LAST_USED_AUTH_PROVIDER_KEY, provider);
        document.cookie = `${LAST_USED_AUTH_PROVIDER_COOKIE}=${provider}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      } catch {
        // Ignore storage write errors and continue auth flow.
      }
    },
    [],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
  });

  async function onLogin(data: AuthValues) {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);

    const next = searchParams.get("next");
    if (next) {
      formData.append("next", next);
    }

    const result = await signInWithPassword(formData);

    if (result?.error) {
      // Confirmation-related errors need the user to check their inbox —
      // show them as a persistent inline banner instead of a vanishing toast.
      const isConfirmationError =
        result.error.toLowerCase().includes("confirm") ||
        result.error.toLowerCase().includes("inbox");
      if (isConfirmationError) {
        setLoginNotice(result.error);
      } else {
        toast.error(result.error);
      }
      setIsLoading(false);
    }
  }

  async function onSignup(data: AuthValues) {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);

    const result = await signUp(formData);

    if (result?.error) {
      toast.error(result.error);
      setIsLoading(false);
    } else {
      setSignupEmail(data.email);
      setSignupExistingLink(
        !!(result as { existingLink?: boolean }).existingLink,
      );
      setSignupTimeLeft(
        (result as { timeLeftHours?: number }).timeLeftHours ?? null,
      );
      setSignupSuccess(true);
      setIsLoading(false);
    }
  }

  async function onPasskeyLogin() {
    try {
      setIsPasskeyLoading(true);

      const resp = await fetch("/api/auth/webauthn/authenticate/options");
      if (!resp.ok) {
        throw new Error("Failed to get authentication options");
      }
      const { options, sessionId } = (await resp.json()) as {
        options: PublicKeyCredentialRequestOptionsJSON;
        sessionId: string;
      };

      const asseResp = await startAuthentication({ optionsJSON: options });

      const verifyResp = await fetch("/api/auth/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: asseResp, sessionId }),
      });

      const verification = (await verifyResp.json()) as {
        success?: boolean;
        error?: string;
      };
      if (verifyResp.ok && verification.success) {
        rememberLastUsedProvider("passkey");
        toast.success("Signed in with Passkey");
        const next = searchParams.get("next");
        if (next && next.startsWith("/")) {
          pushWithTransition(router, next);
        } else {
          pushWithTransition(router, "/dashboard");
        }
        router.refresh();
      } else {
        throw new Error(verification.error || "Verification failed");
      }
    } catch (error: Error | unknown) {
      if (error instanceof Error && error.name === "NotAllowedError") {
        // User cancelled or no keys found. Do not log to console.error
        // as it triggers Next.js dev overlay.
        return;
      }

      console.error("Passkey authentication error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to authenticate with passkey",
      );
    } finally {
      setIsPasskeyLoading(false);
    }
  }

  async function onGoogleSignIn(formData: FormData) {
    const result = await signInWithGoogle(formData);
    if (result?.error) {
      toast.error(result.error);
    }
  }

  async function onGithubSignIn(formData: FormData) {
    const result = await signInWithGithub(formData);
    if (result?.error) {
      toast.error(result.error);
    }
  }

  return (
    <div className="w-[90vw] sm:w-full sm:max-w-md mx-auto px-0 md:px-4">
      <div className="w-full max-w-md mx-auto">
        <div>
          <Card className="border-muted/40 shadow-2xl backdrop-blur-sm bg-background/80">
            {signupSuccess ? (
              <>
                <CardHeader className="space-y-1 pb-2">
                  <div
                    style={{
                      animation:
                        "auth-confirm-in 0.45s cubic-bezier(0.2, 0, 0, 1) both",
                    }}
                    className="flex flex-col items-center gap-4 py-4"
                  >
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20">
                      <Mail className="w-7 h-7 text-primary" />
                    </div>
                    <div className="text-center space-y-1">
                      <CardTitle className="text-2xl font-bold tracking-tight">
                        Check your inbox
                      </CardTitle>
                      <CardDescription className="text-center text-sm leading-relaxed">
                        {signupExistingLink
                          ? `Your confirmation link is still active${signupTimeLeft && signupTimeLeft > 0 ? ` for ~${signupTimeLeft}h` : ""}`
                          : "We sent a confirmation link to"}
                      </CardDescription>
                      <p className="text-sm font-semibold text-foreground break-all">
                        {signupEmail}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent
                  style={{
                    animation:
                      "auth-confirm-in 0.55s 0.08s cubic-bezier(0.2, 0, 0, 1) both",
                  }}
                >
                  <div className="rounded-xl border border-muted/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground space-y-1 text-center">
                    {signupExistingLink ? (
                      <>
                        <p>
                          Your previous link is still valid — check your inbox
                          or spam folder.
                        </p>
                        <p className="text-xs">
                          A new link will only be sent once the current one
                          expires.
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          Click the link in the email to activate your account.
                        </p>
                        <p className="text-xs">
                          Didn&apos;t get it? Check your spam folder.
                        </p>
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full mt-4 gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSignupSuccess(false);
                      setSignupEmail("");
                      setSignupExistingLink(false);
                      setSignupTimeLeft(null);
                      setActiveTab("login");
                    }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </Button>
                </CardContent>
                <CardFooter className="justify-center text-xs text-muted-foreground">
                  <Lock className="w-3 h-3 mr-1" />
                  End-to-end encrypted environment
                </CardFooter>
                <style>{`
                  @keyframes auth-confirm-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
              </>
            ) : (
              <>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-bold tracking-tight text-center">
                    Welcome back
                  </CardTitle>
                  <CardDescription className="text-center">
                    Enter your credentials to access your vault
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {emailConfirmed && (
                    <div
                      style={{
                        animation:
                          "auth-confirm-in 0.4s cubic-bezier(0.2, 0, 0, 1) both",
                      }}
                      className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                        <svg
                          className="h-3 w-3 text-emerald-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          Email confirmed!
                        </p>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">
                          Your account is ready. Sign in below.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => setEmailConfirmed(false)}
                        className="mt-0.5 shrink-0 text-emerald-500/60 hover:text-emerald-500 transition-colors"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                  {passwordUpdated && (
                    <div
                      style={{
                        animation:
                          "auth-confirm-in 0.4s cubic-bezier(0.2, 0, 0, 1) both",
                      }}
                      className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                        <svg
                          className="h-3 w-3 text-emerald-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          Password updated!
                        </p>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">
                          Sign in with your new password below.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => setPasswordUpdated(false)}
                        className="mt-0.5 shrink-0 text-emerald-500/60 hover:text-emerald-500 transition-colors"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                  {deletionScheduled && (
                    <div
                      style={{
                        animation:
                          "auth-confirm-in 0.4s cubic-bezier(0.2, 0, 0, 1) both",
                      }}
                      className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                        <svg className="h-3 w-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          Account deletion scheduled
                        </p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">
                          Sign in within 7 days to cancel it.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => setDeletionScheduled(false)}
                        className="mt-0.5 shrink-0 text-amber-500/60 hover:text-amber-500 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {accountDeleted && (
                    <div
                      style={{
                        animation:
                          "auth-confirm-in 0.4s cubic-bezier(0.2, 0, 0, 1) both",
                      }}
                      className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                        <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          Account deleted
                        </p>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">
                          Your account has been permanently removed.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => setAccountDeleted(false)}
                        className="mt-0.5 shrink-0 text-emerald-500/60 hover:text-emerald-500 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {authExpired && (
                    <div
                      style={{
                        animation:
                          "auth-confirm-in 0.4s cubic-bezier(0.2, 0, 0, 1) both",
                      }}
                      className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/20">
                        <svg className="h-3 w-3 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-destructive">
                          Link expired or invalid
                        </p>
                        <p className="text-xs text-destructive/70 mt-0.5">
                          Try signing up again or use Forgot Password to get a new link.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => setAuthExpired(false)}
                        className="mt-0.5 shrink-0 text-destructive/50 hover:text-destructive transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {loginNotice && (
                    <div
                      style={{
                        animation:
                          "auth-confirm-in 0.4s cubic-bezier(0.2, 0, 0, 1) both",
                      }}
                      className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                        <svg className="h-3 w-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          Check your inbox
                        </p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">
                          {loginNotice}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => setLoginNotice(null)}
                        className="mt-0.5 shrink-0 text-amber-500/60 hover:text-amber-500 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="login">Login</TabsTrigger>
                      <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>

                    <form action={onGoogleSignIn} className="mb-4">
                      <input
                        type="hidden"
                        name="next"
                        value={searchParams.get("next") || "/dashboard"}
                      />
                      <Button
                        id="google-signin-btn"
                        variant="outline"
                        type="submit"
                        className="relative w-full overflow-visible flex items-center justify-center gap-2"
                      >
                        {lastUsedProvider === "google" ? (
                          <LastUsedBadge />
                        ) : null}
                        <svg
                          className="h-4 w-4"
                          aria-hidden="true"
                          focusable="false"
                          data-prefix="fab"
                          data-icon="google"
                          role="img"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 488 512"
                        >
                          <path
                            fill="currentColor"
                            d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                          ></path>
                        </svg>
                        {activeTab === "login" ? "Sign in" : "Sign up"} with
                        Google
                      </Button>
                    </form>
                    <form action={onGithubSignIn} className="mb-4">
                      <input
                        type="hidden"
                        name="next"
                        value={searchParams.get("next") || "/dashboard"}
                      />
                      <Button
                        id="github-signin-btn"
                        variant="outline"
                        type="submit"
                        className="relative w-full overflow-visible flex items-center justify-center gap-2"
                      >
                        {lastUsedProvider === "github" ? (
                          <LastUsedBadge />
                        ) : null}
                        <svg
                          className="h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                        >
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
                        </svg>
                        {activeTab === "login" ? "Sign in" : "Sign up"} with
                        GitHub
                      </Button>
                    </form>

                    {activeTab === "login" && (
                      <div className="mb-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onPasskeyLogin}
                          disabled={isPasskeyLoading || isLoading}
                          className="relative w-full overflow-visible flex items-center justify-center gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                        >
                          {lastUsedProvider === "passkey" ? (
                            <LastUsedBadge />
                          ) : null}
                          {isPasskeyLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Signing in with Passkey...
                            </>
                          ) : (
                            <>
                              <Fingerprint className="h-4 w-4" />
                              Sign in with Passkey
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="relative mb-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-background px-2 text-muted-foreground">
                          OR
                        </span>
                      </div>
                    </div>

                    <TabsContent value="login">
                      <form
                        onSubmit={handleSubmit(onLogin)}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            suppressHydrationWarning
                            id="email"
                            placeholder="name@example.com"
                            type="email"
                            {...register("email")}
                          />
                          {errors.email && (
                            <p className="text-xs text-destructive">
                              {errors.email.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <PasswordInput
                            suppressHydrationWarning
                            id="password"
                            placeholder="Enter password"
                            {...register("password")}
                          />
                          {errors.password && (
                            <p className="text-xs text-destructive">
                              {errors.password.message}
                            </p>
                          )}
                          <div className="flex justify-end mt-1">
                            <Link
                              href="/forgot-password"
                              className="text-xs text-muted-foreground hover:text-primary transition-colors"
                            >
                              Forgot password?
                            </Link>
                          </div>
                        </div>
                        <Button
                          className="w-full"
                          type="submit"
                          disabled={isLoading}
                        >
                          {isLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Sign In
                          <div className="ml-2 hidden md:flex items-center gap-1">
                            <Kbd variant="primary" size="xs">
                              <ModKey />
                            </Kbd>
                            <Kbd variant="primary" size="xs">
                              <CornerDownLeft className="h-3 w-3" />
                            </Kbd>
                          </div>
                        </Button>
                      </form>
                    </TabsContent>

                    <TabsContent value="signup">
                      <form
                        onSubmit={handleSubmit(onSignup)}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">Email</Label>
                          <Input
                            suppressHydrationWarning
                            id="signup-email"
                            placeholder="name@example.com"
                            type="email"
                            {...register("email")}
                          />
                          {errors.email && (
                            <p className="text-xs text-destructive">
                              {errors.email.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">Password</Label>
                          <PasswordInput
                            suppressHydrationWarning
                            id="signup-password"
                            placeholder="Create password"
                            {...register("password")}
                          />
                          {errors.password && (
                            <p className="text-xs text-destructive">
                              {errors.password.message}
                            </p>
                          )}
                        </div>
                        <Button
                          className="w-full"
                          type="submit"
                          disabled={isLoading}
                        >
                          {isLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Create Account
                          <div className="ml-2 hidden md:flex items-center gap-1">
                            <Kbd variant="primary" size="xs">
                              <ModKey />
                            </Kbd>
                            <Kbd variant="primary" size="xs">
                              <CornerDownLeft className="h-3 w-3" />
                            </Kbd>
                          </div>
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </CardContent>
                <CardFooter className="justify-center text-xs text-muted-foreground">
                  <Lock className="w-3 h-3 mr-1" />
                  End-to-end encrypted environment
                </CardFooter>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

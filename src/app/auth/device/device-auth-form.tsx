"use client";

import { useState, useEffect } from "react";
import { verifyDeviceCode } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";

export function DeviceAuthForm() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Only call verify if we have 8 characters.
    if (code.length !== 8) {
      setLoading(false);
      return;
    }

    const formattedCode = code.slice(0, 4) + "-" + code.slice(4, 8);
    const result = await verifyDeviceCode(formattedCode);

    setLoading(false);

    if (result?.error) {
      toast.error(result.error);
    } else {
      setSuccess(true);
    }
  };

  const handleClose = () => {
    try {
      window.close();
    } catch {
      // ignore
    }

    // If the window is still open after a delay, show a message
    setTimeout(() => {
      toast.info(
        "Browser prevented automatic closing. Please close this window manually.",
        {
          duration: 5000,
        },
      );
    }, 300);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (success && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (success && countdown === 0) {
      handleClose();
    }
    return () => clearTimeout(timer);
  }, [success, countdown]);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain");
    const clean = pastedData
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8);
    setCode(clean);
  };

  const handleOnChange = (value: string) => {
    // Sanitize input: Remove dashes, spaces, and ensure uppercase
    // This helps when pasting "ABCD-1234" -> "ABCD1234"
    const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    setCode(clean);
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="w-[90vw] sm:w-full sm:max-w-md mx-auto px-4">
          <Card className="border-green-500/50 bg-green-500/10 dark:bg-green-500/5 shadow-2xl backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl text-green-700 dark:text-green-400">
                Success!
              </CardTitle>
              <CardDescription className="text-green-600/90 dark:text-green-500/90">
                You have successfully authenticated your CLI session.
                <br />
                {countdown > 0 ? (
                  <span>This window will close in {countdown} seconds...</span>
                ) : (
                  <span className="block mt-2 font-medium">
                    You can now safely close this window.
                    <Button
                      variant="outline"
                      className="mt-4 w-full bg-background/50 hover:bg-background/80"
                      onClick={handleClose}
                    >
                      Close Window
                    </Button>
                  </span>
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-[95vw] sm:w-full sm:max-w-md mx-auto px-4">
        <Card className="border-muted/40 shadow-2xl backdrop-blur-sm bg-background/80">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Connect CLI
            </CardTitle>
            <CardDescription>
              Enter the 8-character code displayed in your terminal to
              authenticate.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent>
              <div
                className="space-y-6 flex flex-col items-center"
                onPaste={handlePaste}
              >
                <InputOTP
                  maxLength={8}
                  value={code}
                  onChange={handleOnChange}
                  containerClassName="gap-1 sm:gap-2"
                  pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                >
                  <InputOTPGroup>
                    <InputOTPSlot
                      index={0}
                      className="h-8 w-8 sm:h-10 sm:w-10 text-lg"
                    />
                    <InputOTPSlot
                      index={1}
                      className="h-8 w-8 sm:h-10 sm:w-10 text-lg"
                    />
                    <InputOTPSlot
                      index={2}
                      className="h-8 w-8 sm:h-10 sm:w-10 text-lg"
                    />
                    <InputOTPSlot
                      index={3}
                      className="h-8 w-8 sm:h-10 sm:w-10 text-lg"
                    />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot
                      index={4}
                      className="h-8 w-8 sm:h-10 sm:w-10 text-lg"
                    />
                    <InputOTPSlot
                      index={5}
                      className="h-8 w-8 sm:h-10 sm:w-10 text-lg"
                    />
                    <InputOTPSlot
                      index={6}
                      className="h-8 w-8 sm:h-10 sm:w-10 text-lg"
                    />
                    <InputOTPSlot
                      index={7}
                      className="h-8 w-8 sm:h-10 sm:w-10 text-lg"
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                type="submit"
                disabled={loading || code.length < 8}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {loading ? "Verifying..." : "Verify Code"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AuthLayout>
  );
}

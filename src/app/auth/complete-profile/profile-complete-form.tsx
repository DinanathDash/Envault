"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const RESERVED_USERNAMES = new Set([
  "project",
  "dashboard",
  "settings",
  "login",
  "signup",
  "join",
  "approve",
  "invite",
  "api",
  "auth",
  "status",
  "admin",
]);

type Props = {
  initialFirstName: string;
  initialLastName: string;
  initialUsername: string;
};

export function ProfileCompleteForm({
  initialFirstName,
  initialLastName,
  initialUsername,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [username, setUsername] = useState(initialUsername);
  const [saving, setSaving] = useState(false);

  const isValid = useMemo(() => {
    return (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      username.trim().length > 0
    );
  }, [firstName, lastName, username]);

  const onSave = async () => {
    const normalizedUsername = username
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    if (!isValid || !normalizedUsername) {
      toast.error("Please complete all required fields.");
      return;
    }

    if (RESERVED_USERNAMES.has(normalizedUsername)) {
      toast.error("That username is reserved. Choose another one.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (existing && existing.id !== user.id) {
        toast.error("Username is already taken.");
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          username: normalizedUsername,
        },
      });
      if (authError) {
        toast.error("Could not update your profile.");
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          username: normalizedUsername,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (profileError) {
        toast.error("Could not save your username.");
        return;
      }

      const next = searchParams.get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        router.replace(next);
      } else {
        router.replace("/dashboard");
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-[90vw] sm:w-full sm:max-w-md mx-auto px-0 md:px-4">
      <Card className="border-muted/40 shadow-2xl backdrop-blur-sm bg-background/80">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">
            Complete your profile
          </CardTitle>
          <CardDescription className="text-center">
            Set these details once before entering your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                )
              }
              autoComplete="username"
            />
          </div>
          <Button
            className="w-full"
            onClick={onSave}
            disabled={saving || !isValid}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save and continue"
            )}
          </Button>
        </CardContent>
        <CardFooter className="justify-center text-xs text-muted-foreground">
          <Lock className="w-3 h-3 mr-1" />
          End-to-end encrypted environment
        </CardFooter>
      </Card>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PreferencesSkeleton } from "./notification-skeleton";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { Kbd } from "@/components/ui/kbd";
import { getModifierKey } from "@/lib/utils/utils";

interface NotificationPreferences {
  email_access_requests: boolean;
  email_access_granted: boolean;
  email_device_activity: boolean;
  email_security_alerts: boolean;
  email_project_activity: boolean;
  email_cli_activity: boolean;
  email_system_updates: boolean;
  app_access_requests: boolean;
  app_access_granted: boolean;
  app_device_activity: boolean;
  app_security_alerts: boolean;
  app_project_activity: boolean;
  app_cli_activity: boolean;
  app_system_updates: boolean;
  digest_frequency: "none" | "daily" | "weekly";
}

const defaultPreferences: NotificationPreferences = {
  // Email: only access + device on by default
  email_access_requests: true,
  email_access_granted: true,
  email_device_activity: false,
  email_security_alerts: false,
  email_project_activity: false,
  email_cli_activity: false,
  email_system_updates: false,
  // In-app: all 7 categories on by default
  app_access_requests: true,
  app_access_granted: true,
  app_device_activity: true,
  app_security_alerts: true,
  app_project_activity: true,
  app_cli_activity: true,
  app_system_updates: true,
  digest_frequency: "none",
};

interface SelectRowProps {
  id: string;
  label: string;
  description?: string;
  appChecked: boolean;
  emailChecked: boolean;
  onChange: (app: boolean, email: boolean) => void;
}

function SelectRow({
  id,
  label,
  description,
  appChecked,
  emailChecked,
  onChange,
}: SelectRowProps) {
  const value =
    appChecked && emailChecked
      ? "both"
      : appChecked
      ? "app"
      : emailChecked
      ? "email"
      : "none";

  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium leading-none">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Select
        value={value}
        onValueChange={(val) => {
          onChange(
            val === "both" || val === "app",
            val === "both" || val === "email",
          );
        }}
      >
        <SelectTrigger id={id} className="w-[140px] h-8 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Off</SelectItem>
          <SelectItem value="app">In-App Only</SelectItem>
          <SelectItem value="email">Email Only</SelectItem>
          <SelectItem value="both">Both</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function NotificationPreferences() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences);
  const [initialPreferences, setInitialPreferences] =
    useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPreferences = React.useCallback(async () => {
    let retries = 3;
    while (retries > 0) {
      try {
        const { getNotificationPreferencesAction } =
          await import("@/app/notification-actions");
        const { data, error } = await getNotificationPreferencesAction();
        if (error) throw error;
        if (data) {
          const clean: NotificationPreferences = {
            email_access_requests: data.email_access_requests ?? true,
            email_access_granted: data.email_access_granted ?? true,
            email_device_activity: data.email_device_activity ?? true,
            email_security_alerts: data.email_security_alerts ?? false,
            email_project_activity: data.email_project_activity ?? false,
            email_cli_activity: data.email_cli_activity ?? false,
            email_system_updates: data.email_system_updates ?? false,
            app_access_requests: data.app_access_requests ?? true,
            app_access_granted: data.app_access_granted ?? true,
            app_device_activity: data.app_device_activity ?? true,
            app_security_alerts: data.app_security_alerts ?? true,
            app_project_activity: data.app_project_activity ?? true,
            app_cli_activity: data.app_cli_activity ?? false,
            app_system_updates: data.app_system_updates ?? false,
            digest_frequency: data.digest_frequency ?? "none",
          };
          setPreferences(clean);
          setInitialPreferences(clean);
        }
        break;
      } catch (error) {
        console.error(
          `Failed to fetch preferences (attempt ${4 - retries}/3):`,
          error,
        );
        retries--;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const { updateNotificationPreferencesAction } =
        await import("@/app/notification-actions");
      const { error } = await updateNotificationPreferencesAction(preferences);
      if (error) throw error;
      setInitialPreferences(preferences);
      toast.success("Preferences saved successfully");
    } catch (error) {
      console.error("Failed to save preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    JSON.stringify(preferences) !== JSON.stringify(initialPreferences);

  useHotkeys(
    "mod+s",
    (e) => {
      if (hasChanges && !isSaving) {
        e.preventDefault();
        savePreferences();
      }
    },
    { enableOnFormTags: true },
  );

  const modKey = getModifierKey("mod");

  const setCategory = (
    appKey: keyof NotificationPreferences,
    emailKey: keyof NotificationPreferences,
    appValue: boolean,
    emailValue: boolean,
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [appKey]: appValue,
      [emailKey]: emailValue,
    }));
  };

  const setDigest = (value: "none" | "daily" | "weekly") => {
    setPreferences((prev) => ({ ...prev, digest_frequency: value }));
  };

  if (isLoading) return <PreferencesSkeleton />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose how you receive different types of notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectRow
            id="pref-access-requests"
            label="Access Requests"
            description="When someone requests access to your project"
            appChecked={preferences.app_access_requests}
            emailChecked={preferences.email_access_requests}
            onChange={(app, email) =>
              setCategory(
                "app_access_requests",
                "email_access_requests",
                app,
                email,
              )
            }
          />
          <SelectRow
            id="pref-access-granted"
            label="Access Granted / Denied"
            description="Approvals, rejections, role changes, invitations"
            appChecked={preferences.app_access_granted}
            emailChecked={preferences.email_access_granted}
            onChange={(app, email) =>
              setCategory(
                "app_access_granted",
                "email_access_granted",
                app,
                email,
              )
            }
          />
          <SelectRow
            id="pref-device-activity"
            label="New Device Access"
            description="New CLI devices and unknown logins"
            appChecked={preferences.app_device_activity}
            emailChecked={preferences.email_device_activity}
            onChange={(app, email) =>
              setCategory(
                "app_device_activity",
                "email_device_activity",
                app,
                email,
              )
            }
          />
          <SelectRow
            id="pref-security-alerts"
            label="Security Alerts"
            description="Password changes, 2FA events, encryption failures"
            appChecked={preferences.app_security_alerts}
            emailChecked={preferences.email_security_alerts}
            onChange={(app, email) =>
              setCategory(
                "app_security_alerts",
                "email_security_alerts",
                app,
                email,
              )
            }
          />
          <SelectRow
            id="pref-project-activity"
            label="Project & Secret Activity"
            description="Secrets and project changes by team members"
            appChecked={preferences.app_project_activity}
            emailChecked={preferences.email_project_activity}
            onChange={(app, email) =>
              setCategory(
                "app_project_activity",
                "email_project_activity",
                app,
                email,
              )
            }
          />
          <SelectRow
            id="pref-cli-activity"
            label="CLI Activity"
            description="Secrets pulled or pushed via the CLI"
            appChecked={preferences.app_cli_activity}
            emailChecked={preferences.email_cli_activity}
            onChange={(app, email) =>
              setCategory(
                "app_cli_activity",
                "email_cli_activity",
                app,
                email,
              )
            }
          />
          <SelectRow
            id="pref-system-updates"
            label="System & Maintenance"
            description="Platform updates and scheduled maintenance windows"
            appChecked={preferences.app_system_updates}
            emailChecked={preferences.email_system_updates}
            onChange={(app, email) =>
              setCategory(
                "app_system_updates",
                "email_system_updates",
                app,
                email,
              )
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Digest</CardTitle>
          <CardDescription>
            Receive a periodic summary of your activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="digest-frequency">Frequency</Label>
            <Select
              value={preferences.digest_frequency}
              onValueChange={setDigest}
            >
              <SelectTrigger id="digest-frequency" className="w-[180px]">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={savePreferences} disabled={isSaving || !hasChanges}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
          <span className="ml-2 flex items-center gap-1 text-xs opacity-70">
            <Kbd size="xs">{modKey}</Kbd>
            <Kbd size="xs">S</Kbd>
          </span>
        </Button>
      </div>
    </div>
  );
}

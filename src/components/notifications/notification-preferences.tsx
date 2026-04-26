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
import { Switch } from "@/components/ui/switch";
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
  email_device_activity: true,
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

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium leading-none">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
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

  const set = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => setPreferences((prev) => ({ ...prev, [key]: value }));

  if (isLoading) return <PreferencesSkeleton />;

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Choose what you receive via email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            id="email-access-requests"
            label="Access Requests"
            description="When someone requests access to your project"
            checked={preferences.email_access_requests}
            onChange={(v) => set("email_access_requests", v)}
          />
          <ToggleRow
            id="email-access-granted"
            label="Access Granted / Denied"
            description="When your access request is approved or rejected"
            checked={preferences.email_access_granted}
            onChange={(v) => set("email_access_granted", v)}
          />
          <ToggleRow
            id="email-device-activity"
            label="New Device Access"
            description="When CLI access is granted from a new device"
            checked={preferences.email_device_activity}
            onChange={(v) => set("email_device_activity", v)}
          />
          <ToggleRow
            id="email-security-alerts"
            label="Security Alerts"
            description="Password changes, unknown logins, 2FA events"
            checked={preferences.email_security_alerts}
            onChange={(v) => set("email_security_alerts", v)}
          />
          <ToggleRow
            id="email-project-activity"
            label="Project & Secret Activity"
            description="Secrets added/updated/deleted, project changes"
            checked={preferences.email_project_activity}
            onChange={(v) => set("email_project_activity", v)}
          />
          <ToggleRow
            id="email-cli-activity"
            label="CLI Activity"
            description="Secrets pulled or pushed via the CLI"
            checked={preferences.email_cli_activity}
            onChange={(v) => set("email_cli_activity", v)}
          />
          <ToggleRow
            id="email-system-updates"
            label="System & Maintenance"
            description="Platform updates, scheduled maintenance"
            checked={preferences.email_system_updates}
            onChange={(v) => set("email_system_updates", v)}
          />
        </CardContent>
      </Card>

      {/* In-App Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>In-App Notifications</CardTitle>
          <CardDescription>
            Choose what appears in the notification bell
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            id="app-access-requests"
            label="Access Requests"
            description="When someone requests access to your project"
            checked={preferences.app_access_requests}
            onChange={(v) => set("app_access_requests", v)}
          />
          <ToggleRow
            id="app-access-granted"
            label="Access Granted / Denied"
            description="Approvals, rejections, role changes, invitations"
            checked={preferences.app_access_granted}
            onChange={(v) => set("app_access_granted", v)}
          />
          <ToggleRow
            id="app-device-activity"
            label="New Device Access"
            description="New CLI devices and unknown logins"
            checked={preferences.app_device_activity}
            onChange={(v) => set("app_device_activity", v)}
          />
          <ToggleRow
            id="app-security-alerts"
            label="Security Alerts"
            description="Password changes, 2FA events, encryption failures"
            checked={preferences.app_security_alerts}
            onChange={(v) => set("app_security_alerts", v)}
          />
          <ToggleRow
            id="app-project-activity"
            label="Project & Secret Activity"
            description="Secrets and project changes by team members"
            checked={preferences.app_project_activity}
            onChange={(v) => set("app_project_activity", v)}
          />
          <ToggleRow
            id="app-cli-activity"
            label="CLI Activity"
            description="Secrets pulled or pushed via the CLI"
            checked={preferences.app_cli_activity}
            onChange={(v) => set("app_cli_activity", v)}
          />
          <ToggleRow
            id="app-system-updates"
            label="System & Maintenance"
            description="Platform updates and scheduled maintenance windows"
            checked={preferences.app_system_updates}
            onChange={(v) => set("app_system_updates", v)}
          />
        </CardContent>
      </Card>

      {/* Email Digest */}
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
              onValueChange={(value: "none" | "daily" | "weekly") =>
                set("digest_frequency", value)
              }
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

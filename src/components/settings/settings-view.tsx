"use client";

import { useState, useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { useEnvaultStore } from "@/lib/store";
import { SecurityTab } from "./security-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupportView } from "@/components/support/support-view";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  User,
  HelpCircle,
  Trash2,
  Shield,
  Bell,
  Command,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  CornerDownLeft,
} from "lucide-react";
import { toast } from "sonner";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { deleteAccountAction } from "@/app/actions";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { Kbd } from "@/components/ui/kbd";
import { AppHeader } from "@/components/dashboard/app-header";
import { inferUsernameFromAuth } from "@/lib/username";

const ModKey = () => (
  <>
    <span className="non-mac-only">Ctrl</span>
    <Command className="w-3 h-3 mac-only" />
  </>
);

export default function SettingsView() {
  const { user, updateUser, deleteAccount, projects } = useEnvaultStore();

  const searchParams = useSearchParams();
  const pathname = usePathname();

  // State for navigation
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get("tab") || "profile",
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    const currentUrlTab = searchParams.get("tab");
    const defaultTab = "profile";
    // Only update URL if it differs from state
    if (activeTab === defaultTab && !currentUrlTab) return;
    if (activeTab !== currentUrlTab) {
      const params = new URLSearchParams(searchParams.toString());
      if (activeTab === defaultTab) {
        params.delete("tab");
      } else {
        params.set("tab", activeTab);
      }
      const query = params.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      window.history.replaceState(null, "", url);
    }
  }, [activeTab, mounted, pathname, searchParams]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // State for form fields
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [username, setUsername] = useState(user?.username || "");
  const [userIdCopied, setUserIdCopied] = useState(false);
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setUsername(user.username || "");
    }
  }, [user]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleUpdateProfile = async () => {
    if (!username || username.trim() === "") {
      toast.error("Username cannot be empty");
      return;
    }

    // Guard against reserved route keywords that would conflict with Next.js static routes
    const RESERVED_USERNAMES = [
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
    ];
    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
      toast.error(
        `"${username}" is a reserved keyword and cannot be used as a username.`,
      );
      return;
    }

    setIsUpdatingProfile(true);

    try {
      const supabase = createClient();

      // Check uniqueness if changing
      if (username !== user?.username) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .maybeSingle();

        if (existingProfile && existingProfile.id !== user?.id) {
          toast.error("This username is already taken. Please choose another.");
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          username,
          full_name: `${firstName} ${lastName}`.trim(),
        },
      });

      if (error) {
        toast.error("Failed to update profile");
        return;
      }

      updateUser({
        firstName,
        lastName,
        username,
      });
      toast.success("Profile updated successfully");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const inferredDefaultBase = inferUsernameFromAuth(
    user?.email,
    user?.user_metadata as Record<string, unknown> | undefined,
  );
  const escapedDefaultBase = inferredDefaultBase.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const defaultUsernameRegex = new RegExp(`^${escapedDefaultBase}(-\\d+)?$`);
  const hasCustomizedUsername = user?.username
    ? !defaultUsernameRegex.test(user.username)
    : false;

  const handleDeleteAccountClick = () => {
    setDeleteConfirmation("");
    setIsDeleteConfirmed(false);
    setDeleteDialogOpen(true);
  };

  const handleDeleteAccountConfirm = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsDeletingAccount(true);
    try {
      const result = await deleteAccountAction();
      if (result?.error) {
        toast.error(result.error);
        setDeleteDialogOpen(false);
        return;
      }
      deleteAccount(); // Clear local store
      toast.success("Account deleted");
      setDeleteDialogOpen(false);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleCopyUserIdentifier = async () => {
    const identifier = user?.username || user?.email || "";
    try {
      await navigator.clipboard.writeText(identifier);
      setUserIdCopied(true);
      setTimeout(() => setUserIdCopied(false), 2000);
    } catch {
      toast.error("Failed to copy identifier");
    }
  };

  // Shortcuts
  useEffect(() => {
    const tabs = ["profile", "security", "notifications", "support", "danger"];

    const handleSwitch = (e: Event) => {
      const customEvent = e as CustomEvent;
      const index = customEvent.detail.index;
      if (index >= 0 && index < tabs.length) {
        setActiveTab(tabs[index]);
      }
    };

    const handlePrev = () => {
      setActiveTab((prev) => {
        const idx = tabs.indexOf(prev);
        return idx > 0 ? tabs[idx - 1] : tabs[tabs.length - 1];
      });
    };

    const handleNext = () => {
      setActiveTab((prev) => {
        const idx = tabs.indexOf(prev);
        return idx < tabs.length - 1 ? tabs[idx + 1] : tabs[0];
      });
    };

    document.addEventListener("switch-tab", handleSwitch);
    document.addEventListener("prev-tab", handlePrev);
    document.addEventListener("next-tab", handleNext);

    return () => {
      document.removeEventListener("switch-tab", handleSwitch);
      document.removeEventListener("prev-tab", handlePrev);
      document.removeEventListener("next-tab", handleNext);
    };
  }, []);

  // Shortcut for saving profile
  useHotkeys(
    "mod+s",
    (e) => {
      if (activeTab === "profile") {
        e.preventDefault();
        handleUpdateProfile();
      }
    },
    { enableOnContentEditable: true, enableOnFormTags: true },
  );

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader title="Settings" backTo="/dashboard" hideSearch />

      <main className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row gap-8 relative">
          <aside className="w-full md:w-64 space-y-2 md:sticky md:top-28 md:h-fit">
            <nav className="flex md:flex-col space-x-2 md:space-x-0 md:space-y-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <Button
                variant={activeTab === "profile" ? "secondary" : "ghost"}
                className="justify-start w-full flex items-center gap-2"
                onClick={() => setActiveTab("profile")}
              >
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
                <Kbd className="ml-auto h-5 px-1.5 text-[10px] bg-muted/50 border-0">
                  1
                </Kbd>
              </Button>
              <Button
                variant={activeTab === "security" ? "secondary" : "ghost"}
                className="justify-start w-full flex items-center gap-2"
                onClick={() => setActiveTab("security")}
              >
                <Shield className="mr-2 h-4 w-4" />
                <span>Security</span>
                <Kbd className="ml-auto h-5 px-1.5 text-[10px] bg-muted/50 border-0">
                  2
                </Kbd>
              </Button>
              <Button
                variant={activeTab === "notifications" ? "secondary" : "ghost"}
                className="justify-start w-full flex items-center gap-2"
                onClick={() => setActiveTab("notifications")}
              >
                <Bell className="mr-2 h-4 w-4" />
                <span>Notifications</span>
                <Kbd className="ml-auto h-5 px-1.5 text-[10px] bg-muted/50 border-0">
                  3
                </Kbd>
              </Button>
              <Button
                variant={activeTab === "support" ? "secondary" : "ghost"}
                className="justify-start w-full flex items-center gap-2"
                onClick={() => setActiveTab("support")}
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Support</span>
                <Kbd className="ml-auto h-5 px-1.5 text-[10px] bg-muted/50 border-0">
                  4
                </Kbd>
              </Button>
              <Button
                variant={activeTab === "danger" ? "secondary" : "ghost"}
                className="justify-start w-full text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-destructive/10 flex items-center gap-2"
                onClick={() => setActiveTab("danger")}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete Account</span>
                <Kbd className="ml-auto h-5 px-1.5 text-[10px] bg-muted/50 border-0">
                  5
                </Kbd>
              </Button>
            </nav>
          </aside>

          <div className="flex-1 max-w-2xl">
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium">Profile information</h2>
                </div>

                <Card>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid gap-2">
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="bg-background"
                        suppressHydrationWarning
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="bg-background"
                        suppressHydrationWarning
                      />
                    </div>

                    <div className="grid gap-2">
                      <div className="flex justify-between">
                        <Label htmlFor="email">Primary email</Label>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Primary email is used for account notifications.
                      </p>
                      <div className="relative">
                        <Input
                          id="email"
                          value={user?.email || ""}
                          disabled
                          className="bg-muted pr-10"
                          suppressHydrationWarning
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="username">Username</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Username appears as a display name throughout the
                        dashboard and is used in your public project sharing
                        links.
                      </p>

                      {!hasCustomizedUsername && (
                        <div className="mb-3 p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex gap-3">
                          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-1">
                            <h5 className="font-medium leading-none tracking-tight text-destructive">
                              Warning
                            </h5>
                            <p className="text-sm text-destructive">
                              You can only change your username once. Changing
                              your username will alter the sharing links for all
                              your projects. Any existing links you have shared
                              will instantly break.
                            </p>
                          </div>
                        </div>
                      )}

                      <Input
                        id="username"
                        value={username}
                        onChange={(e) =>
                          setUsername(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, ""),
                          )
                        }
                        disabled={hasCustomizedUsername}
                        className="bg-background"
                        suppressHydrationWarning
                      />
                      {hasCustomizedUsername && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Your username is permanently locked to prevent broken
                          sharing links.
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button
                        onClick={handleUpdateProfile}
                        className="px-8"
                        disabled={
                          isUpdatingProfile ||
                          (firstName === (user?.firstName || "") &&
                            lastName === (user?.lastName || "") &&
                            username === (user?.username || ""))
                        }
                      >
                        {isUpdatingProfile ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            Save Changes{" "}
                            <span className="ml-2 flex items-center gap-1">
                              <Kbd className="bg-primary-foreground/20 text-primary-foreground border-0">
                                <ModKey />
                              </Kbd>
                              <Kbd className="bg-primary-foreground/20 text-primary-foreground border-0">
                                S
                              </Kbd>
                            </span>
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "security" && <SecurityTab user={user} />}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium">
                    Notification Preferences
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage how and when you receive notifications
                  </p>
                </div>
                <NotificationPreferences />
              </div>
            )}

            {activeTab === "support" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium">Support</h2>
                </div>
                <SupportView inDashboard={true} />
              </div>
            )}

            {activeTab === "danger" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium text-red-600 dark:text-red-500">
                    Danger Zone
                  </h2>
                </div>
                <Card className="border-destructive/20">
                  <CardHeader>
                    <CardTitle className="text-red-600 dark:text-red-500">
                      Delete Account
                    </CardTitle>
                    <CardDescription>
                      Permanently remove your account and all data.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      This action is irreversible. All your projects,
                      environment variables, and personal data will be
                      permanently deleted.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccountClick}
                    >
                      Delete Account
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account? This action cannot
              be undone and will permanently delete your account and all
              associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-4">
            {isDeletingAccount && (
              <div className="p-3 border rounded-md bg-muted/50 text-sm text-muted-foreground flex items-start gap-2">
                <Loader2 className="h-4 w-4 animate-spin mt-0.5 shrink-0" />
                <p>
                  Deletion is in progress. We are safely transferring any shared
                  project secrets you created to the project owners and
                  preserving audit history before removing your account.
                </p>
              </div>
            )}

            {projects.length > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md space-y-3">
                <p className="text-sm font-medium text-destructive">
                  You have {projects.length} active project
                  {projects.length === 1 ? "" : "s"}.
                </p>
                <p className="text-sm text-muted-foreground">
                  Please consider migrating them before deletion. If you
                  proceed, they will be permanently lost.
                </p>
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="confirm-delete-projects"
                    checked={isDeleteConfirmed}
                    onChange={(e) => setIsDeleteConfirmed(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-destructive focus:ring-destructive"
                  />
                  <label
                    htmlFor="confirm-delete-projects"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I understand that my projects will be permanently deleted.
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label
                htmlFor="delete-confirmation"
                className="text-sm font-normal"
              >
                To confirm, type{" "}
                <span className="inline-flex items-center gap-1 font-bold">
                  &quot;{user?.username || user?.email}&quot;{" "}
                  {userIdCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy
                      className="h-4 w-4 cursor-pointer hover:text-primary"
                      onClick={handleCopyUserIdentifier}
                    />
                  )}
                </span>{" "}
                below:
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={user?.username || user?.email}
                className="bg-background"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccountConfirm}
              disabled={
                isDeletingAccount ||
                deleteConfirmation !== (user?.username || user?.email) ||
                (projects.length > 0 && !isDeleteConfirmed)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transferring data and deleting...
                </>
              ) : (
                "Delete Account"
              )}
              {!isDeletingAccount && (
                <div className="hidden sm:flex items-center gap-1">
                  <Kbd variant="primary" size="xs">
                    <ModKey />
                  </Kbd>
                  <Kbd variant="primary" size="xs">
                    <CornerDownLeft className="h-3 w-3" />
                  </Kbd>
                </div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

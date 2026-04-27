"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Settings as SettingsIcon,
  LogOut,
  Search,
  Keyboard,
  Activity,
  ArrowLeft,
  LayoutDashboard,
  Bell,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn, getModifierKey } from "@/lib/utils/utils";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { useEnvaultStore } from "@/lib/stores/store";
import { signOut } from "@/app/actions";
import { useRouter } from "next/navigation";
import { pushWithTransition } from "@/lib/utils/view-transition-navigation";

interface AppHeaderProps {
  title?: string | React.ReactNode;
  backTo?: string;
  actions?: React.ReactNode;
  hideSearch?: boolean;
  className?: string;
  contentClassName?: string;
}

export function AppHeader({
  title,
  backTo,
  actions,
  hideSearch = false,
  className,
  contentClassName,
}: AppHeaderProps) {
  const { user, logout } = useEnvaultStore();
  const router = useRouter();

  const handleBack = () => {
    // Use explicit route back targets to avoid browser-history loops when
    // users bounce between contextual pages (e.g. project <-> audit logs).
    if (backTo) {
      pushWithTransition(router, backTo, "nav-back");
      return;
    }

    pushWithTransition(router, "/dashboard", "nav-back");
  };

  const handleLogout = async () => {
    logout();
    await signOut();
  };

  const iconHoverClass =
    "rounded-md hover:bg-background/95 dark:hover:bg-accent/80 dark:hover:text-accent-foreground";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-background/95 backdrop-blur",
        className,
      )}
    >
      <div
        className={cn(
          "container mx-auto flex items-center justify-between px-4 py-3 sm:py-3.5 md:py-4",
          contentClassName,
        )}
      >
        <div className="flex items-center gap-2">
          {backTo ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className={cn("[&_svg]:!w-5 [&_svg]:!h-5", iconHoverClass)}
            >
              <ArrowLeft />
            </Button>
          ) : (
            !title && (
              <Link href="/" className="flex items-center space-x-2">
                <ShieldCheck className="w-6 h-6 text-primary" />
                <span className="font-bold text-2xl font-serif">Envault</span>
              </Link>
            )
          )}

          {title && (
            <div className="flex flex-col">
              {typeof title === "string" ? (
                <h1 className="font-bold text-lg">{title}</h1>
              ) : (
                title
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {!hideSearch && (
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground hidden md:flex items-center gap-2 h-9 border-border/80 bg-background/70 hover:bg-background hover:border-border"
              onClick={() => {
                document.dispatchEvent(new CustomEvent("open-global-search"));
              }}
            >
              <Search className="w-4 h-4" />
              Search...
              <div className="ml-2 hidden md:flex items-center gap-1">
                <Kbd size="xs">{getModifierKey("mod")}</Kbd>
                <Kbd size="xs">K</Kbd>
              </div>
            </Button>
          )}

          {actions}

          <AnimatedThemeToggler
            className={cn(
              "h-10 w-10 inline-flex items-center justify-center",
              iconHoverClass,
            )}
          />
          <NotificationDropdown bellClassName={iconHoverClass} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("rounded-full", iconHoverClass)}
              >
                <UserAvatar
                  user={{
                    email: user?.email,
                    avatar: user?.avatar,
                    firstName: user?.firstName,
                  }}
                  className="h-8 w-8"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.firstName || "User"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || "user@example.com"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user?.app_metadata?.is_admin === true && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/admin/system"
                      className="cursor-pointer flex w-full items-center"
                    >
                      <Activity className="mr-2 h-4 w-4 text-green-600" />
                      <span>System Status</span>
                      <div className="ml-auto hidden md:flex items-center gap-1">
                        <Kbd size="xs">G</Kbd>
                        <Kbd size="xs">S</Kbd>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link
                  href="/dashboard"
                  className="cursor-pointer flex w-full items-center"
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                  <div className="ml-auto hidden md:flex items-center gap-1">
                    <Kbd size="xs">G</Kbd>
                    <Kbd size="xs">H</Kbd>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/notifications"
                  className="cursor-pointer flex w-full items-center"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  <span>Notifications</span>
                  <div className="ml-auto hidden md:flex items-center gap-1">
                    <Kbd size="xs">G</Kbd>
                    <Kbd size="xs">L</Kbd>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/settings"
                  className="cursor-pointer flex w-full items-center"
                >
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                  <div className="ml-auto hidden md:flex items-center gap-1">
                    <Kbd size="xs">G</Kbd>
                    <Kbd size="xs">O</Kbd>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() =>
                  document.dispatchEvent(new CustomEvent("open-shortcut-help"))
                }
              >
                <Keyboard className="mr-2 h-4 w-4" />
                <span>Keyboard Shortcuts</span>
                <div className="ml-auto hidden md:flex items-center gap-1">
                  <Kbd size="xs">Shift</Kbd>
                  <Kbd size="xs">?</Kbd>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 dark:text-red-500 focus:text-red-600 dark:focus:text-red-500 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

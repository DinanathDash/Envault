"use client";

import { useState, useEffect } from "react";
import { NotificationBell } from "./notification-bell";
import { NotificationItem } from "./notification-item";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotificationStore } from "@/lib/stores/notification-store";
import { Inbox, Trash2 } from "lucide-react";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { NotificationSkeleton } from "./notification-skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";

export function NotificationDropdown() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { notifications, isLoading, markAllAsRead, deleteAllRead } =
    useNotificationStore();
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.is_read);
  const recentNotifications = notifications.slice(0, 5);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleClearRead = async () => {
    await deleteAllRead();
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Listen for global shortcut event
  useEffect(() => {
    const handleToggle = () => {
      setShowTooltip(false);
      setOpen((prev) => !prev);
    };
    document.addEventListener("toggle-notifications", handleToggle);
    return () =>
      document.removeEventListener("toggle-notifications", handleToggle);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setShowTooltip(false);
  };

  useHotkeys(
    "m",
    () => {
      if (open && unreadNotifications.length > 0) {
        handleMarkAllRead();
      }
    },
    { enabled: open },
  );

  useHotkeys(
    "c",
    () => {
      if (open && notifications.some((n) => n.is_read)) {
        handleClearRead();
      }
    },
    { enabled: open },
  );

  useHotkeys(
    "v",
    () => {
      if (open) {
        router.push("/notifications");
        setOpen(false);
      }
    },
    { enabled: open },
  );

  if (!mounted) {
    return <NotificationBell />;
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <Tooltip open={showTooltip && !open}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <NotificationBell
              data-notification-trigger
              onPointerEnter={() => setShowTooltip(true)}
              onPointerLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(false)}
              onBlur={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(false)}
            />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p className="flex items-center gap-2">
            Notifications{" "}
            <span className="hidden md:flex items-center gap-1">
              <Kbd>Shift</Kbd>
              <Kbd>B</Kbd>
            </span>
          </p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        align={isMobile ? "center" : "end"}
        className="w-[90vw] max-w-[400px] sm:w-[400px] p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex flex-row items-center justify-between p-4 border-b gap-2">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2 w-auto">
            {unreadNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="h-7 text-xs flex-1 sm:flex-none flex items-center gap-1.5"
              >
                Mark all read
                <Kbd variant="ghost" size="xs" className="ml-1.5">
                  M
                </Kbd>
              </Button>
            )}
            {notifications.some((n) => n.is_read) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearRead}
                className="h-7 text-xs flex-1 sm:flex-none flex items-center gap-1.5"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear read
                <Kbd variant="ghost" size="xs" className="ml-1.5">
                  C
                </Kbd>
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[50vh] sm:max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="divide-y">
              <NotificationSkeleton />
              <NotificationSkeleton />
              <NotificationSkeleton />
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Inbox className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            recentNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClose={() => setOpen(false)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 5 && (
          <div className="border-t p-2">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full text-sm">
                View all notifications
                <Kbd variant="ghost" size="xs" className="ml-2">
                  V
                </Kbd>
              </Button>
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

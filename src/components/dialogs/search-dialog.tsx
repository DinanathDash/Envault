/* eslint-disable react-hooks/refs */
"use client";

import * as React from "react";
import {
  Search,
  Folder,
  Settings,
  LogOut,
  Sun,
  Moon,
  Home,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Bell,
  Github,
  User,
  FilesIcon,
  Activity,
  Shield,
  FileText,
  HelpCircle,
  Key,
  ShieldAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useEnvaultStore } from "@/lib/stores/store";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut } from "@/app/actions";
import { cn } from "@/lib/utils/utils";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CommandItem = {
  id: string;
  type: "project" | "command";
  icon: React.ReactNode;
  label: string;
  action: () => void;
};

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isKeyboardMode, setIsKeyboardMode] = React.useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const savedScrollPosition = React.useRef<number>(0);
  const { user, logout, projects } = useEnvaultStore();
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const pathname = usePathname();

  // Detect if we are on a project page
  const projectPathMatch = pathname.match(/^\/project\/([^\/]+)/);
  const activeProjectId = projectPathMatch ? projectPathMatch[1] : null;
  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Save scroll position when dialog opens, restore when it closes
  React.useEffect(() => {
    if (open) {
      // Save current scroll position when opening
      savedScrollPosition.current = window.scrollY;
      setQuery("");
      setSelectedIndex(0);
    } else {
      // Restore scroll position when closing
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        window.scrollTo({
          top: savedScrollPosition.current,
          behavior: "instant",
        });
      });
    }
  }, [open]);

  const handleNavigation = React.useCallback(
    (path: string) => {
      savedScrollPosition.current = window.scrollY;
      router.push(path);
    },
    [router],
  );

  const commands: CommandItem[] = React.useMemo(() => {
    const items: CommandItem[] = [];

    // 1. App / Authenticated Routes
    if (user) {
      items.push(
        {
          id: "nav-dashboard",
          type: "command",
          icon: <Home className="w-4 h-4" />,
          label: "Go to Dashboard",
          action: () => handleNavigation("/dashboard"),
        },
        {
          id: "nav-settings",
          type: "command",
          icon: <Settings className="w-4 h-4" />,
          label: "Go to Settings",
          action: () => handleNavigation("/settings"),
        },
        {
          id: "nav-notifications",
          type: "command",
          icon: <Bell className="w-4 h-4" />,
          label: "Go to Notifications",
          action: () => handleNavigation("/notifications"),
        },
      );

      // Check for admin role
      const isAdmin = user.app_metadata?.is_admin === true;
      if (isAdmin) {
        items.push({
          id: "nav-admin-system",
          type: "command",
          icon: <ShieldAlert className="w-4 h-4" />,
          label: "Admin: System Status",
          action: () => handleNavigation("/admin/system"),
        });
      }
    }

    // 2. Landing / Marketing Routes
    // Home is usually useful even if logged in to see the landing page, but mostly useful if not logged in.
    if (!user) {
      items.push({
        id: "nav-home",
        type: "command",
        icon: <Home className="w-4 h-4" />,
        label: "Go to Home",
        action: () => handleNavigation("/"),
      });
    }

    // These public routes can be useful even if logged in
    items.push(
      {
        id: "nav-docs",
        type: "command",
        icon: <FilesIcon className="w-4 h-4" />,
        label: "Documentation",
        action: () => handleNavigation("/docs"),
      },
      {
        id: "nav-support",
        type: "command",
        icon: <HelpCircle className="w-4 h-4" />,
        label: "Support",
        action: () => handleNavigation("/support"),
      },
      {
        id: "nav-status",
        type: "command",
        icon: <Activity className="w-4 h-4" />,
        label: "System Status",
        action: () => handleNavigation("/status"),
      },
      {
        id: "nav-privacy",
        type: "command",
        icon: <Shield className="w-4 h-4" />,
        label: "Privacy Policy",
        action: () => handleNavigation("/privacy"),
      },
      {
        id: "nav-terms",
        type: "command",
        icon: <FileText className="w-4 h-4" />,
        label: "Terms of Service",
        action: () => handleNavigation("/terms"),
      },
      {
        id: "nav-github",
        type: "command",
        icon: <Github className="w-4 h-4" />,
        label: "GitHub Repository",
        action: () =>
          window.open("https://github.com/DinanthDash/Envault", "_blank"),
      },
    );

    // 3. Auth Routes
    if (!user) {
      items.push(
        {
          id: "nav-login",
          type: "command",
          icon: <User className="w-4 h-4" />,
          label: "Login / Sign Up",
          action: () => handleNavigation("/login"),
        },
        {
          id: "nav-forgot-password",
          type: "command",
          icon: <Key className="w-4 h-4" />,
          label: "Forgot Password",
          action: () => handleNavigation("/forgot-password"),
        },
      );
    }

    // 4. System / Actions
    items.push({
      id: "action-theme",
      type: "command",
      icon:
        theme === "dark" ? (
          <Sun className="w-4 h-4" />
        ) : (
          <Moon className="w-4 h-4" />
        ),
      label: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
      action: () => setTheme(theme === "dark" ? "light" : "dark"),
    });

    if (user) {
      items.push({
        id: "action-logout",
        type: "command",
        icon: <LogOut className="w-4 h-4" />,
        label: "Log out",
        action: async () => {
          logout();
          await signOut();
        },
      });
    }

    return items;
  }, [user, theme, setTheme, logout, handleNavigation]);

  const contextualCommands = React.useMemo(() => {
    const items: CommandItem[] = [];
    if (!user) return items;

    if (activeProjectId && activeProject) {
      items.push({
        id: "context-new-variable",
        type: "command",
        icon: <Plus className="w-4 h-4 text-green-500" />,
        label: `Add Variable to ${activeProject.name}`,
        action: () => {
          document.dispatchEvent(new CustomEvent("open-new-variable"));
        },
      });
    } else if (pathname === "/dashboard") {
      items.push({
        id: "context-new-project",
        type: "command",
        icon: <Plus className="w-4 h-4 text-green-500" />,
        label: "Create New Project",
        action: () => {
          document.dispatchEvent(new CustomEvent("universal-new"));
        },
      });
    }
    return items;
  }, [user, activeProjectId, activeProject, pathname]);

  const filteredProjects = React.useMemo(() => {
    if (!user) return [];

    return projects
      .filter((project) =>
        project.name.toLowerCase().includes(query.toLowerCase()),
      )
      .map((p) => ({
        id: `project-${p.id}`,
        type: "project",
        icon: <Folder className="w-4 h-4 text-primary" />,
        label: p.name,
        action: () => {
          savedScrollPosition.current = window.scrollY;
          if (p.isShared && p.owner_username && p.role !== "owner") {
            router.push(`/${p.owner_username}/${p.slug}`);
          } else {
            router.push(`/project/${p.slug}`);
          }
        },
      }));
  }, [user, projects, query, router]);

  const filteredCommands = React.useMemo(
    () =>
      commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()),
      ),
    [commands, query],
  );

  const allItems = React.useMemo(
    () => [...contextualCommands, ...filteredCommands, ...filteredProjects],
    [contextualCommands, filteredCommands, filteredProjects],
  );

  // Keyboard Navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (allItems.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsKeyboardMode(true);
        if (e.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % allItems.length);
        } else {
          setSelectedIndex(
            (prev) => (prev - 1 + allItems.length) % allItems.length,
          );
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selectedItem = allItems[selectedIndex];
        if (selectedItem) {
          selectedItem.action();
          onOpenChange(false);
        }
      }
    },
    [allItems, selectedIndex, onOpenChange],
  );

  // Auto-scroll selected item into view
  React.useEffect(() => {
    if (isKeyboardMode) {
      const container = scrollContainerRef.current;
      const item = listRef.current?.children[selectedIndex] as HTMLElement;
      if (container && item) {
        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.offsetHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.offsetHeight;

        if (itemTop < containerTop) {
          container.scrollTo({ top: itemTop - 8, behavior: "smooth" });
        } else if (itemBottom > containerBottom) {
          container.scrollTo({
            top: itemBottom - container.offsetHeight + 8,
            behavior: "smooth",
          });
        }
      }
    }
  }, [selectedIndex, isKeyboardMode]);

  const mousePos = React.useRef({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.clientX !== mousePos.current.x || e.clientY !== mousePos.current.y) {
      setIsKeyboardMode(false);
      mousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] md:w-full sm:max-w-[550px] p-0 gap-0 overflow-hidden outline-none top-[5%] md:top-[20%] translate-y-0 duration-200">
        <DialogHeader className="px-4 py-4 border-b">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-muted-foreground" />
            <DialogTitle className="sr-only">Search</DialogTitle>
            <DialogDescription className="sr-only">
              Search projects and run quick commands.
            </DialogDescription>
            <Input
              placeholder="Type a command or search..."
              className="border-0 focus-visible:ring-0 px-0 h-auto text-base shadow-none"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        </DialogHeader>
        <div
          className="relative h-auto min-h-[100px] max-h-[50vh] md:max-h-[300px] overflow-y-auto p-2"
          ref={scrollContainerRef}
          onMouseMove={handleMouseMove}
        >
          {allItems.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No results found.
            </div>
          ) : (
            <div className="flex flex-col gap-1" ref={listRef}>
              {allItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full p-2 text-sm rounded-md text-left transition-colors",
                    selectedIndex === index
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50 text-foreground",
                  )}
                  onMouseEnter={() =>
                    !isKeyboardMode && setSelectedIndex(index)
                  }
                >
                  <div
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      selectedIndex === index ? "bg-background" : "bg-muted",
                    )}
                  >
                    {item.icon}
                  </div>
                  <span className="font-medium flex-1">{item.label}</span>
                  {item.type === "command" && (
                    <span className="text-xs text-muted-foreground capitalize">
                      Command
                    </span>
                  )}
                  {item.type === "project" && (
                    <span className="text-xs text-muted-foreground capitalize">
                      Project
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground flex items-center justify-between px-4">
          <div className="flex gap-4">
            <span className="hidden md:flex items-center gap-1">
              <Kbd>
                <ArrowUp className="w-3 h-3" />
              </Kbd>
              <Kbd>
                <ArrowDown className="w-3 h-3" />
              </Kbd>{" "}
              to navigate
            </span>
            <span className="hidden md:flex items-center gap-1">
              <Kbd>
                <CornerDownLeft className="w-3 h-3" />
              </Kbd>{" "}
              to select
            </span>
            <span className="md:hidden text-xs">Tap to select</span>
          </div>
          <button
            onClick={() =>
              document.dispatchEvent(new CustomEvent("open-shortcut-help"))
            }
            className="flex items-center gap-1 hover:text-foreground transition-colors cursor-help"
          >
            Press <Kbd>?</Kbd> for help
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

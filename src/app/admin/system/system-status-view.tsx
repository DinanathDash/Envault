"use client";

import {
  Component,
  updateComponentStatus,
  createIncident,
  updateIncident,
  createComponent,
} from "@/actions/status";
import { useState, useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { DateDisplay } from "@/components/ui/date-display";
import { Plus, CornerDownLeft, Loader2 } from "lucide-react";
import { STATUS_CONFIG } from "@/lib/system/status-config";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { Kbd } from "@/components/ui/kbd";
import { getModifierKey } from "@/lib/utils/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface AdminStatusViewProps {
  initialComponents: Component[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialIncidents: any[]; // Using any for now to avoid strict type complexity, but locally typed as Incident[]
}

import { AppHeader } from "@/components/dashboard/ui/app-header";

// Custom event type
// Custom event type
declare global {
  interface DocumentEventMap {
    "admin-system-new": CustomEvent<{ tab: string }>;
  }
}

export default function SystemStatusView({
  initialComponents,
  initialIncidents,
}: AdminStatusViewProps) {
  const [components, setComponents] = useState(initialComponents);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [incidents, setIncidents] = useState(initialIncidents);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get("tab") || "components",
  );
  const [mounted, setMounted] = useState(false);

  // Set mounted state
  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      // eslint-disable-next-line
      setMounted(true);
    }
    // Initial backwards compatibility migration hook from hash to param
    if (window.location.hash === "#incidents") {
      setActiveTab("incidents");
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync tab state with URL
  useEffect(() => {
    if (!mounted) return;
    const currentUrlTab = searchParams.get("tab");
    const defaultTab = "components";
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

  // Keyboard shortcut: 'n' to create new component/incident based on active tab
  useHotkeys(
    "n",
    () => {
      document.dispatchEvent(
        new CustomEvent("admin-system-new", { detail: { tab: activeTab } }),
      );
    },
    { enableOnContentEditable: false, enableOnFormTags: false },
  );

  // Keyboard shortcut: '1' to switch to components tab
  useHotkeys("1", () => setActiveTab("components"), {
    enableOnContentEditable: false,
    enableOnFormTags: false,
  });

  // Keyboard shortcut: '2' to switch to incidents tab
  useHotkeys(
    "2",
    () => {
      setActiveTab("incidents");
    },
    { enableOnContentEditable: false, enableOnFormTags: false },
  );

  // Optimistic UI updates
  const handleStatusChange = async (id: string, newStatus: string) => {
    const originalComponents = [...components];

    // Optimistic update
    setComponents((prev) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prev.map((c) => (c.id === id ? { ...c, status: newStatus as any } : c)),
    );
    toast.info("Updating component status...");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateComponentStatus(id, newStatus as any);
      toast.success("Component status updated");
    } catch (error: unknown) {
      console.error(error);
      setComponents(originalComponents); // Revert
      toast.error("Failed to update status");
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <AppHeader
        title={
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold truncate">
              System Status Center
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Manage real-time status updates and incident communication.
            </p>
          </div>
        }
        backTo="/dashboard"
        hideSearch
      />
      <main className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="components">
                Components
                <Kbd className="ml-2 text-xs">1</Kbd>
              </TabsTrigger>
              <TabsTrigger value="incidents">
                Incidents
                <Kbd className="ml-2 text-xs">2</Kbd>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="components" className="space-y-4">
              <div className="flex justify-end">
                <CreateComponentDialog />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>System Components</CardTitle>
                  <CardDescription>
                    Manage the operational status of individual system
                    components.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {components.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                      No components found. Create your first component to get
                      started.
                    </div>
                  ) : (
                    components.map((component) => (
                      <div
                        key={component.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-card gap-3"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_CONFIG[component.status as keyof typeof STATUS_CONFIG]?.dot ?? "bg-muted-foreground"}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">
                              {component.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {component.description || "No description"}
                            </p>
                          </div>
                        </div>
                        <Select
                          defaultValue={component.status}
                          onValueChange={(value) =>
                            handleStatusChange(component.id, value)
                          }
                        >
                          <SelectTrigger className="w-auto">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operational">
                              Operational
                            </SelectItem>
                            <SelectItem value="degraded">Degraded</SelectItem>
                            <SelectItem value="outage">Outage</SelectItem>
                            <SelectItem value="maintenance">
                              Maintenance
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="incidents" className="space-y-4">
              <IncidentManager
                initialIncidents={incidents}
                components={components}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function CreateComponentDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Listen for keyboard shortcut event
  useEffect(() => {
    const handleShortcut = (e: CustomEvent<{ tab: string }>) => {
      if (e.detail?.tab === "components") {
        setOpen(true);
      }
    };
    document.addEventListener("admin-system-new", handleShortcut);
    return () =>
      document.removeEventListener("admin-system-new", handleShortcut);
  }, []);

  const handleCreate = async () => {
    if (isCreating) return;

    // Validate required fields
    if (!name.trim()) {
      toast.error("Component name is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Component description is required");
      return;
    }

    setIsCreating(true);

    try {
      await createComponent(name.trim(), description.trim());
      toast.success("Component created");
      setOpen(false);
      setName("");
      setDescription("");
      window.location.reload();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Component <Kbd>N</Kbd>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add System Component</DialogTitle>
          <DialogDescription>
            Add a new component to your status page (e.g., API, Website,
            Database).
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="comp-name">Name</Label>
              <Input
                id="comp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Core API"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="comp-desc">Description</Label>
              <Input
                id="comp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Main backend services"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !name.trim() || !description.trim()}
              className="flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Component <Kbd>{getModifierKey("mod")}</Kbd>
                  <Kbd>
                    <CornerDownLeft className="w-3 h-3" />
                  </Kbd>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IncidentManager({
  initialIncidents,
  components,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialIncidents: any[];
  components: Component[];
}) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [incidents, setIncidents] = useState(initialIncidents);

  // Form State
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [status, setStatus] = useState("investigating");
  const [message, setMessage] = useState("");
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);

  // Listen for keyboard shortcut event
  useEffect(() => {
    const handleShortcut = (e: CustomEvent<{ tab: string }>) => {
      if (e.detail?.tab === "incidents") {
        setOpen(true);
      }
    };
    document.addEventListener("admin-system-new", handleShortcut);
    return () =>
      document.removeEventListener("admin-system-new", handleShortcut);
  }, []);

  const resetForm = () => {
    setTitle("");
    setSeverity("minor");
    setStatus("investigating");
    setMessage("");
    setSelectedComponents([]);
  };

  const handleCreate = async () => {
    // Prevent double-submission
    if (isCreating) return;

    // Validate required fields
    if (!title.trim()) {
      toast.error("Incident title is required");
      return;
    }
    if (!message.trim()) {
      toast.error("Initial message is required");
      return;
    }
    if (selectedComponents.length === 0) {
      toast.error("Please select at least one affected component");
      return;
    }

    setIsCreating(true);
    try {
      await createIncident(
        title.trim(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        severity as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status as any,
        selectedComponents,
        message.trim(),
      );
      toast.success("Incident created");
      setOpen(false);
      resetForm();

      // Preserve the incidents tab on reload by using replace first
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("tab", "incidents");
      window.history.replaceState(null, "", currentUrl.toString());
      window.location.reload();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Recent Incidents</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Incident <Kbd>N</Kbd>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Incident</DialogTitle>
              <DialogDescription>
                Log a new system incident. This will be visible on the public
                status page.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
            >
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., API Latency Spikes"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="severity">Severity</Label>
                    <Select value={severity} onValueChange={setSeverity}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Initial Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="investigating">
                          Investigating
                        </SelectItem>
                        <SelectItem value="identified">Identified</SelectItem>
                        <SelectItem value="monitoring">Monitoring</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Affected Components</Label>
                  <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2 bg-muted/50">
                    {components.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No components available. Create components in the
                        &apos;Components&apos; tab first.
                      </div>
                    ) : (
                      components.map((c) => (
                        <div key={c.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`comp-${c.id}`}
                            checked={selectedComponents.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedComponents([
                                  ...selectedComponents,
                                  c.id,
                                ]);
                              else
                                setSelectedComponents(
                                  selectedComponents.filter(
                                    (id) => id !== c.id,
                                  ),
                                );
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <label
                            htmlFor={`comp-${c.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {c.name}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-[0.8rem] text-muted-foreground">
                    Select the components impacted by this incident.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="message">Initial Message</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="We are currently investigating..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isCreating ||
                    !title.trim() ||
                    !message.trim() ||
                    selectedComponents.length === 0
                  }
                  className="flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Incident <Kbd>{getModifierKey("mod")}</Kbd>
                      <Kbd>
                        <CornerDownLeft className="w-3 h-3" />
                      </Kbd>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {initialIncidents.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-lg border-dashed">
            No recent incidents found.
          </div>
        ) : (
          initialIncidents.map((incident) => (
            <Card key={incident.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-bold flex flex-wrap items-center gap-2">
                      <span className="flex">{incident.title}</span>
                      <Badge
                        variant={
                          incident.status === "resolved"
                            ? "outline"
                            : "destructive"
                        }
                      >
                        {incident.status.charAt(0).toUpperCase() +
                          incident.status.slice(1)}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Started{" "}
                      <DateDisplay
                        date={incident.created_at}
                        addSuffix
                        formatType="absolute"
                      />
                    </CardDescription>
                  </div>
                  <UpdateIncidentDialog incident={incident} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {incident.incident_updates &&
                    incident.incident_updates.length > 0 && (
                      <div className="text-sm pt-2 border-t">
                        <p className="font-semibold mb-1">Latest Update:</p>
                        <p>{incident.incident_updates[0].message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <DateDisplay
                            date={incident.incident_updates[0].created_at}
                            addSuffix
                            formatType="absolute"
                          />
                        </p>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function UpdateIncidentDialog({
  incident,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  incident: any;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(incident.status);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    if (isUpdating) return;

    // Validate required fields
    if (!message.trim()) {
      toast.error("Update message is required");
      return;
    }

    setIsUpdating(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateIncident(incident.id, status as any, message.trim());
      toast.success("Incident updated");
      setOpen(false);

      // Preserve the incidents tab on reload
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("tab", "incidents");
      window.history.replaceState(null, "", currentUrl.toString());
      window.location.reload();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Update
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Incident</DialogTitle>
          <DialogDescription>
            Post a status update and optionally change the incident phase.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUpdate();
          }}
        >
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>New Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Update Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g., Fix implemented, monitoring results."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={isUpdating || !message.trim()}
              className="flex items-center gap-2"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  Post Update <Kbd>{getModifierKey("mod")}</Kbd>
                  <Kbd>
                    <CornerDownLeft className="w-3 h-3" />
                  </Kbd>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

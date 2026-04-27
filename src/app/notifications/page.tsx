import { NotificationsList } from "@/components/notifications/notifications-list";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";

export default function NotificationsPage() {
  return (
    <AuthenticatedShell
      title={
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold truncate">
            Notifications
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
            Manage all your notifications
          </p>
        </div>
      }
      backTo="/dashboard"
      hideSearch
    >
      <main className="container mx-auto py-4 sm:py-8 px-3 sm:px-4 max-w-7xl">
        <NotificationsList />
      </main>
    </AuthenticatedShell>
  );
}

import { AppHeader } from "@/components/dashboard/ui/app-header";
import { cn } from "@/lib/utils/utils";

interface AuthenticatedShellProps {
  children: React.ReactNode;
  title?: string | React.ReactNode;
  backTo?: string;
  actions?: React.ReactNode;
  hideSearch?: boolean;
  contentClassName?: string;
}

export function AuthenticatedShell({
  children,
  title,
  backTo,
  actions,
  hideSearch = false,
  contentClassName,
}: AuthenticatedShellProps) {
  return (
    <div className="min-h-screen bg-[#ecebe8] p-1 sm:p-2 md:p-3 lg:p-4 dark:bg-background">
      <div className="mx-auto flex min-h-[calc(100vh-0.5rem)] w-full max-w-[1920px] flex-col overflow-hidden rounded-[32px] border border-[#d4d2ce] bg-[#e3e2df] shadow-[inset_0_1px_0_rgba(255,255,255,0.52),0_16px_40px_rgba(15,23,42,0.08)] sm:min-h-[calc(100vh-1.25rem)] md:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-2.5rem)] dark:border-border/70 dark:bg-muted/20 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.55)]">
        <AppHeader
          title={title}
          backTo={backTo}
          actions={actions}
          hideSearch={hideSearch}
          className="bg-transparent"
          contentClassName="mx-0 max-w-none px-4 py-2 sm:px-6 sm:py-2.5 md:px-8 md:py-3"
        />

        <div className="flex-1 px-2 pb-2 pt-1 sm:px-3 sm:pb-3 sm:pt-1.5 md:px-4 md:pb-4 md:pt-0.5 lg:px-4 lg:pb-4 lg:pt-0">
          <section
            className={cn(
              "h-full min-h-[420px] overflow-auto rounded-[26px] p-1 sm:p-2 md:p-3 lg:p-4 border border-[#d9d6cf] bg-[#faf9f6] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:bg-background dark:border-border/60 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
              contentClassName,
            )}
          >
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}

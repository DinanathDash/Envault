"use client";

import { useMemo } from "react";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { cn } from "@/lib/utils/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/tabs";
import { CopyButton } from "@/components/copy-button";
import { IconSwap, IconSwapItem } from "@/components/icon-swap";
import { siGnubash, siHomebrew, siNpm } from "simple-icons";

export type InstallMethod = "script" | "brew" | "npm";

const installMethodAtom = atomWithStorage<InstallMethod>(
  "installMethod",
  "script",
);

export function useInstallMethod() {
  return useAtom(installMethodAtom);
}

export type CodeBlockCommandProps = {
  script?: string;
  brew?: string;
  npm?: string;
  onCopySuccess?: (data: { method: InstallMethod; command: string }) => void;
  onCopyError?: (error: Error) => void;
};

export function CodeBlockCommand({
  script,
  brew,
  npm,
  onCopySuccess,
  onCopyError,
}: CodeBlockCommandProps) {
  const [method, setMethod] = useInstallMethod();

  const tabs = useMemo(() => {
    return { script, brew, npm };
  }, [script, brew, npm]);

  const tabsFiltered = useMemo(
    () => Object.entries(tabs).filter(([, value]) => !!value),
    [tabs],
  );

  return (
    <div className="relative overflow-hidden bg-transparent">
      <Tabs
        className="gap-0"
        value={method}
        onValueChange={(value) => {
          setMethod(value as InstallMethod);
        }}
      >
        <ScrollArea.Root className="w-full shadow-[inset_0_-1px_0_0] shadow-border">
          <TabsList
            className={cn(
              "h-10 max-w-full justify-start rounded-none bg-transparent p-0 pl-4 inset-ring-0 dark:bg-transparent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
              "[--scroll-area-overflow-x-end:inherit] [--scroll-area-overflow-x-start:inherit]",
            )}
            render={<ScrollArea.Viewport />}
          >
            <IconSwap>
              <IconSwapItem className="mr-2" key={method}>
                {getIconForInstallMethod(method)}
              </IconSwapItem>
            </IconSwap>

            {tabsFiltered.map(([key]) => {
              return (
                <TabsTrigger
                  key={key}
                  className="h-7 rounded-none p-0 px-2 font-mono uppercase"
                  value={key}
                >
                  {key}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </ScrollArea.Root>

        {tabsFiltered.map(([key, value]) => {
          return (
            <TabsContent key={key} value={key}>
              <pre
                data-pm={key}
                className="group/tabs-content-pre p-4 pr-12 leading-6 whitespace-pre-wrap break-all"
              >
                <code
                  data-slot="code-block"
                  data-language="bash"
                  className="font-mono text-sm/none text-muted-foreground"
                >
                  <span className="select-none">$ </span>
                  {value}
                </code>
              </pre>
            </TabsContent>
          );
        })}
      </Tabs>

      <CopyButton
        className="absolute top-2 right-2 z-10 size-6 rounded-none border-none hover:bg-transparent hover:text-zinc-900 dark:hover:text-white [&_svg:not([class*='size-'])]:size-3.5 hover:cursor-pointer"
        variant="ghost"
        size="icon"
        text={tabs[method] || ""}
        onCopySuccess={(copiedCommand) => {
          onCopySuccess?.({
            method,
            command: copiedCommand,
          });
        }}
        onCopyError={onCopyError}
      />
    </div>
  );
}

function getIconForInstallMethod(method: InstallMethod) {
  const icon =
    method === "script" ? siGnubash :
    method === "brew" ? siHomebrew :
    siNpm;

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  );
}

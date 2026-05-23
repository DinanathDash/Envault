"use client"

import { useMemo } from "react"
import { ScrollArea } from "@base-ui/react/scroll-area"
import { useAtom } from "jotai"
import { atomWithStorage } from "jotai/utils"

import { cn } from "@/lib/utils/utils"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/tabs"
import { CopyButton } from "@/components/copy-button"
import { IconSwap, IconSwapItem } from "@/components/icon-swap"

export type InstallMethod = "script" | "brew" | "npm"

const installMethodAtom = atomWithStorage<InstallMethod>(
  "installMethod",
  "script"
)

export function useInstallMethod() {
  return useAtom(installMethodAtom)
}

export type CodeBlockCommandProps = {
  script?: string
  brew?: string
  npm?: string
  onCopySuccess?: (data: { method: InstallMethod; command: string }) => void
  onCopyError?: (error: Error) => void
}

export function CodeBlockCommand({
  script,
  brew,
  npm,
  onCopySuccess,
  onCopyError,
}: CodeBlockCommandProps) {
  const [method, setMethod] = useInstallMethod()

  const tabs = useMemo(() => {
    return { script, brew, npm }
  }, [script, brew, npm])

  const tabsFiltered = useMemo(
    () => Object.entries(tabs).filter(([, value]) => !!value),
    [tabs]
  )

  return (
    <div className="relative overflow-hidden bg-code">
      <Tabs
        className="gap-0"
        value={method}
        onValueChange={(value) => {
          setMethod(value as InstallMethod)
        }}
      >
        <ScrollArea.Root className="w-full shadow-[inset_0_-1px_0_0] shadow-border">
          <TabsList
            className={cn(
              "h-10 max-w-full justify-start rounded-none bg-transparent p-0 pl-4 inset-ring-0 dark:bg-transparent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
              "[--scroll-area-overflow-x-end:inherit] [--scroll-area-overflow-x-start:inherit]"
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
              )
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
          )
        })}
      </Tabs>

      <CopyButton
        className="absolute top-2 right-2 z-10 size-6 rounded-none border-none hover:bg-transparent hover:text-white [&_svg:not([class*='size-'])]:size-3.5"
        variant="ghost"
        size="icon-sm"
        text={tabs[method] || ""}
        onCopySuccess={(copiedCommand) => {
          onCopySuccess?.({
            method,
            command: copiedCommand,
          })
        }}
        onCopyError={onCopyError}
      />
    </div>
  )
}

function getIconForInstallMethod(method: InstallMethod) {
  switch (method) {
    case "script":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" /></svg>
      )
    case "brew":
      return (
        <svg role="img" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><title>Homebrew</title><path d="M7.938 0a.214.214 0 0 0-.206.156c-.316 1.104.179 2.15.838 2.935.153.181.313.347.476.501a2.039 2.039 0 0 0-.665.02c-1.184.233-2.193.985-2.74 2.532a3.893 3.893 0 0 0-.2 1.466 1.565 1.565 0 0 0-1.156 1.504 1.59 1.59 0 0 0 1.227 1.541l.026 12.046c0 .195.1.377.264.482a.214.214 0 0 0 .008.005c.537.31 2.047.812 5.21.812 3.238 0 4.7-.678 5.181-1.04a.214.214 0 0 0 .008-.007.571.571 0 0 0 .206-.439c.002-.344.002-1.136.002-1.604a.143.143 0 0 1 .147-.144c.397.006.869.006 1.318.005a1.826 1.826 0 0 0 1.832-1.825v-5.804a1.826 1.826 0 0 0-1.825-1.826H16.56a.14.14 0 0 1-.143-.144V10.6h.007v-.001a1.573 1.573 0 0 0 1.356-1.556c0-.816-.627-1.489-1.424-1.563-.025-1.438-.437-2.126-.736-2.58a.214.214 0 0 0-.005-.007c-.364-.51-1.193-1.282-2.275-1.316-.503-.016-.842.124-1.125.254-.217.1-.42.177-.67.22.002-1.286.945-1.981.945-1.981a.214.214 0 0 0 .05-.298s-.087-.122-.21-.26c-.121-.136-.269-.294-.47-.378a.214.214 0 0 0-.079-.017.214.214 0 0 0-.145.055 4.308 4.308 0 0 0-.875 1.101 3.42 3.42 0 0 0-.133.273 3.497 3.497 0 0 0-.381-.846C9.794.978 9.063.436 8.017.016A.214.214 0 0 0 7.939 0zm.156.524c.85.378 1.43.83 1.79 1.403.274.438.426.962.484 1.584a3.07 3.07 0 0 0-.012.462 6.897 6.897 0 0 1-.168-.052 5.487 5.487 0 0 1-1.29-1.106c-.551-.657-.935-1.46-.804-2.291zM11.8 1.618c.07.054.141.101.212.18.034.039.032.04.058.073-.332.308-1.07 1.144-.952 2.453a.214.214 0 0 0 .222.195c.469-.017.782-.172 1.056-.299.273-.126.508-.228.931-.214.875.027 1.639.715 1.939 1.134.295.449.65 1 .663 2.36a1.66 1.66 0 0 0-.41.142 1.938 1.938 0 0 0-1.77-1.16 1.94 1.94 0 0 0-1.87 1.448 1.783 1.783 0 0 0-1.356-.64c-.484 0-.91.205-1.233.517a1.873 1.873 0 0 0-1.85-1.625c-.649 0-1.218.335-1.552.84a3.1 3.1 0 0 1 .157-.735c.51-1.437 1.355-2.045 2.42-2.254.367-.073.664-.011.99.095.325.106.671.262 1.094.342a.214.214 0 0 0 .252-.245c-.112-.67.073-1.266.336-1.744a3.71 3.71 0 0 1 .663-.863zM7.44 6.611a1.442 1.442 0 0 1 1.363 1.925.214.214 0 0 0 .168.283h.005a.214.214 0 0 0 .238-.146 1.373 1.373 0 0 1 2.613-.01.214.214 0 0 0 .417-.09 1.509 1.509 0 0 1 1.504-1.664c.678 0 1.249.445 1.442 1.056a.214.214 0 0 0 .259.143l.15-.04a.214.214 0 0 0 .051-.02 1.139 1.139 0 0 1 1.702.995 1.14 1.14 0 0 1-.985 1.131.214.214 0 0 0-.001 0 2.215 2.215 0 0 0-.485.126 10.65 10.65 0 0 1-1.176.365.214.214 0 0 0-.162.186 1.276 1.276 0 0 1-.146.478 2.07 2.07 0 0 0-.239 1.111l.001.151a.438.438 0 0 1-.16.36.665.665 0 0 1-.43.14.586.586 0 0 1-.588-.59.803.803 0 0 0-.38-.681.214.214 0 0 0-.002-.002c-.24-.145-.43-.37-.532-.636a.214.214 0 0 0-.207-.138 19.469 19.469 0 0 1-5.37-.6l-.003-.002a9.007 9.007 0 0 0-.838-.194h.003a1.16 1.16 0 0 1-.937-1.134c0-.619.488-1.118 1.101-1.14a.214.214 0 0 0 .204-.176 1.443 1.443 0 0 1 1.42-1.187zm8.549 4.106v.455c0 .314.259.573.572.573h1.329a1.397 1.397 0 0 1 1.397 1.397v5.804a1.396 1.396 0 0 1-1.402 1.396.214.214 0 0 0-.002 0c-.448.002-.918 0-1.31-.005a.573.573 0 0 0-.584.573c0 .468 0 1.262-.002 1.603a.214.214 0 0 0 0 .001c0 .042-.019.08-.05.107-.346.26-1.75.95-4.915.95-3.107 0-4.587-.52-4.99-.752a.143.143 0 0 1-.065-.118l-.025-11.955c.145.033.288.07.431.11a.214.214 0 0 0 .003 0c.115.031.246.064.383.097v10.37c0 .129.069.247.18.31.453.217 1.767.732 4.071.732 2.32 0 3.595-.626 4.022-.884a.357.357 0 0 0 .164-.3l.001-10.21c.267-.075.531-.158.792-.254zm-7.99.894a.493.493 0 0 1 .494.493v8.578a.493.493 0 0 1-.493.493.493.493 0 0 1-.494-.493v-8.578A.493.493 0 0 1 8 11.611zm8.652 1.14a.663.663 0 0 0-.662.662v5.208a.663.663 0 0 0 .662.662h1.14a.663.663 0 0 0 .662-.662v-5.209a.663.663 0 0 0-.662-.662zm0 .428h1.14a.233.233 0 0 1 .233.233v5.21a.233.233 0 0 1-.233.232h-1.14a.233.233 0 0 1-.233-.233v-5.209a.233.233 0 0 1 .233-.233z"/></svg>
      )
    case "npm":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" /></svg>
      )
  }
}

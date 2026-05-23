"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils/utils"

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative z-0 flex h-8 w-fit items-center justify-center rounded-none p-0.5",
        "bg-zinc-50 text-muted-foreground dark:bg-zinc-900",
        "inset-ring-1 inset-ring-border/64",
        className
      )}
      {...props}
    />
  )
}

// Removed TabsIndicator per requirements

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "flex flex-1 shrink-0 items-center justify-center gap-2 rounded-none px-4 py-1 font-sans text-sm font-medium whitespace-nowrap transition-[color,background-color] outline-none hover:text-foreground focus-visible:inset-ring-1 focus-visible:inset-ring-ring disabled:pointer-events-none disabled:opacity-50 data-active:bg-zinc-900 data-active:text-white dark:data-active:bg-zinc-100 dark:data-active:text-zinc-900 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }

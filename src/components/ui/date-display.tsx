"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/utils";

interface DateDisplayProps {
  date: Date | string | number;
  formatType?: "relative" | "absolute" | "date" | "time";
  addSuffix?: boolean;
  className?: string;
}

export function DateDisplay({
  date,
  formatType = "absolute",
  addSuffix = false,
  className,
}: DateDisplayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span
        className={cn(
          "inline-block h-4 w-24 animate-pulse rounded-md bg-muted align-middle",
          className,
        )}
        aria-hidden="true"
      />
    );
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return <span className={className}>Invalid date</span>;
  }

  const isCurrentYear = parsedDate.getFullYear() === new Date().getFullYear();
  let displayString = "";

  switch (formatType) {
    case "relative":
      displayString = formatDistanceToNow(parsedDate, { addSuffix });
      break;
    case "absolute":
      displayString = new Intl.DateTimeFormat(undefined, {
        dateStyle: isCurrentYear ? "medium" : "long",
        timeStyle: "short",
      }).format(parsedDate);
      break;
    case "date":
      displayString = new Intl.DateTimeFormat(undefined, {
        dateStyle: isCurrentYear ? "medium" : "long",
      }).format(parsedDate);
      break;
    case "time":
      displayString = new Intl.DateTimeFormat(undefined, {
        timeStyle: "short",
      }).format(parsedDate);
      break;
  }

  return <span className={className}>{displayString}</span>;
}

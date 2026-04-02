import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ReactNode } from "react";
import { Command, Option, ChevronUp } from "lucide-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getModifierKey(
  modifier: "mod" | "alt" | "shift" | "ctrl",
): ReactNode {
  switch (modifier) {
    case "mod":
      return (
        <span className="inline-flex items-center align-middle">
          <Command className="w-3 h-3" />
        </span>
      );
    case "alt":
      return (
        <span className="inline-flex items-center align-middle">
          <Option className="w-3 h-3" />
        </span>
      );
    case "ctrl":
      return (
        <span className="inline-flex items-center align-middle">
          <ChevronUp className="w-3 h-3" />
        </span>
      );
    case "shift":
      return "Shift";
    default:
      return "";
  }
}

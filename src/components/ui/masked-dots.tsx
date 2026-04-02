import { Dot } from "lucide-react";
import { cn } from "@/lib/utils/utils";

interface MaskedDotsProps {
  count?: number;
  className?: string;
  dotClassName?: string;
}

export function MaskedDots({
  count = 8,
  className,
  dotClassName,
}: MaskedDotsProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center gap-0 align-middle leading-none",
        className,
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <Dot
          key={index}
          className={cn(
            "h-5 w-5 shrink-0 -mx-1.5 text-foreground/80",
            dotClassName,
          )}
        />
      ))}
    </span>
  );
}

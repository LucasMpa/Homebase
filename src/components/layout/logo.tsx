import { HouseIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** O quadrado verde com a casa, sem o nome. */
export function LogoMark({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span className={cn("flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground", className)}>
      <HouseIcon className={cn("size-4", iconClassName)} aria-hidden />
    </span>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
      <LogoMark />
      Homebase
    </span>
  );
}

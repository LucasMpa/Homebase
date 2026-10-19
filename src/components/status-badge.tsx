import { AlertTriangleIcon, CheckIcon, ClockIcon, CircleDotIcon } from "lucide-react";
import type { OccurrenceStatus } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

const STYLES: Record<OccurrenceStatus, { label: string; className: string; icon: typeof CheckIcon }> = {
  overdue: { label: "Atrasada", className: "bg-overdue text-white", icon: AlertTriangleIcon },
  due_today: { label: "Vence hoje", className: "bg-primary text-primary-foreground", icon: CircleDotIcon },
  upcoming: { label: "A vencer", className: "bg-muted text-foreground ring-1 ring-border", icon: ClockIcon },
  paid: { label: "Paga", className: "text-muted-foreground ring-1 ring-border", icon: CheckIcon },
};

export function StatusBadge({ status, className }: { status: OccurrenceStatus; className?: string }) {
  const { label, className: style, icon: Icon } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        style,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

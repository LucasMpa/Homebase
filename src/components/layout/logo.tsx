import { HouseIcon } from "lucide-react";

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <HouseIcon className="size-4" aria-hidden />
      </span>
      Homebase
    </span>
  );
}

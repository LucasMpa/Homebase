import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SegmentedNavItem {
  href: string;
  label: string;
  active: boolean;
}

/** Abas de filtro baseadas em links (estado na URL), ocupando toda a largura. */
export function SegmentedNav({
  label,
  items,
  className,
}: {
  /** Nome acessível do grupo, ex.: "Filtro" ou "Período". */
  label: string;
  items: SegmentedNavItem[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("mb-4 flex w-full rounded-lg bg-muted p-1 ring-1 ring-border", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            // Altura de 40px no celular (alvo de toque); mais compacto a partir do md.
            "flex min-h-10 flex-1 items-center justify-center rounded-md px-2 py-1.5 text-center md:min-h-0 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            item.active && "bg-card text-foreground shadow-sm",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

"use client";

import { BarChart3Icon, HandCoinsIcon, HouseIcon, ReceiptTextIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/reports", label: "Relatórios", icon: BarChart3Icon },
  { href: "/transactions", label: "Lançamentos", icon: WalletIcon },
  { href: "/bills", label: "Contas", icon: ReceiptTextIcon },
  { href: "/third-party", label: "Terceiros", icon: HandCoinsIcon },
] as const;

/** Na barra inferior do celular, o botão do início (logo) fica no meio, entre as duas metades. */
const BOTTOM_LEFT = NAV.slice(0, 2);
const BOTTOM_RIGHT = NAV.slice(2);

function isActive(pathname: string, href: string) {
  // Seções com subrotas (detalhe, novo, editar) ficam ativas nelas também.
  if (href === "/bills" || href === "/transactions" || href === "/third-party") return pathname.startsWith(href);
  return pathname === href;
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              active && "bg-secondary text-secondary-foreground",
            )}
          >
            <Icon className={cn("size-4", active && "text-primary")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {/* Coluna do meio só com o tamanho do botão: as quatro de texto dividem o resto. */}
      <ul className="mx-auto grid max-w-md grid-cols-[1fr_1fr_auto_1fr_1fr]">
        {BOTTOM_LEFT.map((item) => (
          <BottomNavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <li className="flex items-center justify-center px-1">
          <Link
            href="/"
            title="Início: esta semana"
            aria-label="Homebase, início"
            aria-current={pathname === "/" ? "page" : undefined}
            className="rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* Quadrado verde com a casa, no tom dos ícones da barra; o logo do app fica no cabeçalho. */}
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95",
                pathname === "/" && "ring-2 ring-primary-foreground/30 ring-inset",
              )}
            >
              <HouseIcon className="size-6" aria-hidden />
            </span>
          </Link>
        </li>
        {BOTTOM_RIGHT.map((item) => (
          <BottomNavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </ul>
    </nav>
  );
}

function BottomNavItem({ item: { href, label, icon: Icon }, active }: { item: (typeof NAV)[number]; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          // Com o botão do meio sobram ~66px por item em 320px: "Lançamentos" só cabe numa linha com 10px.
          "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:bg-secondary min-[360px]:text-[11px] min-[390px]:text-xs",
          active && "text-primary",
        )}
      >
        <Icon className="size-6" aria-hidden />
        {label}
      </Link>
    </li>
  );
}

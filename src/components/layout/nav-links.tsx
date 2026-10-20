"use client";

import { BarChart3Icon, CalendarCheck2Icon, HandCoinsIcon, PlusIcon, ReceiptTextIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/relatorios", label: "Relatórios", icon: BarChart3Icon },
  { href: "/mes", label: "Este mês", icon: CalendarCheck2Icon },
  { href: "/lancamentos", label: "Lançamentos", icon: WalletIcon },
  { href: "/contas", label: "Contas", icon: ReceiptTextIcon },
  { href: "/terceiros", label: "Terceiros", icon: HandCoinsIcon },
] as const;

/** A barra inferior do celular é mais estreita: "Este mês" fica de fora (acessível pelo card da home). */
const BOTTOM_NAV = NAV.filter((item) => item.href !== "/mes");

function isActive(pathname: string, href: string) {
  // Seções com subrotas (detalhe, novo, editar) ficam ativas nelas também.
  if (href === "/contas" || href === "/lancamentos" || href === "/terceiros") return pathname.startsWith(href);
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
  const middle = BOTTOM_NAV.length / 2;

  const renderItem = ({ href, label, icon: Icon }: (typeof BOTTOM_NAV)[number]) => {
    const active = isActive(pathname, href);
    return (
      <li key={href}>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            // 4 itens + o botão em 320px: "Lançamentos" precisa caber numa linha, sem cortar.
            "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:bg-secondary min-[360px]:text-xs",
            active && "text-primary",
          )}
        >
          <Icon className="size-6" aria-hidden />
          {label}
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {/* Coluna do meio do tamanho do botão: sobra mais largura para os rótulos. */}
      <ul className="mx-auto grid max-w-md grid-cols-[1fr_1fr_auto_1fr_1fr] items-center">
        {BOTTOM_NAV.slice(0, middle).map(renderItem)}
        <li>
          <Link
            href="/lancamentos/novo"
            aria-label="Registrar gasto"
            title="Registrar gasto"
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-sidebar outline-none transition-transform active:scale-95 focus-visible:ring-ring/50"
          >
            <PlusIcon className="size-7" aria-hidden />
          </Link>
        </li>
        {BOTTOM_NAV.slice(middle).map(renderItem)}
      </ul>
    </nav>
  );
}

import { LogOutIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { BottomNav, SidebarNav } from "@/components/layout/nav-links";
import { Logo } from "@/components/layout/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Checagem no servidor, independente do proxy.
  const { user } = await requireUser();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <Link href="/" title="Início: esta semana" aria-label="Homebase, início" className="mb-8 rounded-lg px-2 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <Link href="/lancamentos/novo" className={buttonVariants({ className: "mb-4 w-full" })}>
          <PlusIcon aria-hidden /> Gasto
        </Link>
        <SidebarNav />
        <div className="mt-auto space-y-2 border-t border-border pt-4">
          <p className="truncate px-2 text-xs text-muted-foreground" title={user.email}>
            {user.email}
          </p>
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="w-full justify-start text-muted-foreground">
              <LogOutIcon aria-hidden /> Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/" title="Início: esta semana" aria-label="Homebase, início" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            {/* h-10: alvo de toque de 40px, mesmo tamanho do botão Sair. */}
            <Link
              href="/lancamentos/novo"
              aria-label="Registrar gasto"
              className={cn(buttonVariants({ size: "sm" }), "h-10")}
            >
              <PlusIcon aria-hidden /> Gasto
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sair">
                <LogOutIcon aria-hidden />
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-12">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}

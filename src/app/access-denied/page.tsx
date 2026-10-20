import { ShieldXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Acesso negado" };

/** Pública e estática: o proxy já encerrou a sessão antes de chegar aqui. */
export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl bg-card p-8 text-center ring-1 ring-foreground/10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-overdue text-white">
          <ShieldXIcon className="size-7" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="font-heading text-xl font-semibold">Acesso negado</h1>
          <p className="text-sm text-muted-foreground">
            Esta conta Google não tem permissão para usar o Homebase. Você foi desconectado.
          </p>
        </div>
        <Link href="/login" className={buttonVariants({ variant: "outline", className: "w-full" })}>
          Entrar com outra conta
        </Link>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { GoogleIcon } from "@/components/google-icon";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 rounded-2xl bg-card p-8 ring-1 ring-foreground/10">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">As contas da casa, sem esquecer nenhum vencimento.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-overdue bg-secondary p-3 text-sm">
            Não foi possível entrar com o Google. Tente novamente.
          </p>
        )}
        <form action={signInWithGoogle}>
          <Button type="submit" size="lg" className="w-full">
            <span className="flex size-5 items-center justify-center rounded-full bg-white">
              <GoogleIcon className="size-3.5" />
            </span>
            Entrar com Google
          </Button>
        </form>
      </div>
    </main>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "@/components/ui/toast";

/**
 * Mostra o toast de uma mutação que terminou em redirect (a action não tem
 * como chamar o toast) e tira o parâmetro `param` da URL. Usa router.replace,
 * não history.replaceState: assim a entrada do histórico passa a ser a URL
 * limpa, e Voltar/Avançar não reaproveita o payload que tinha o toast.
 * Sem `message` (valor desconhecido na URL), só limpa o parâmetro.
 */
export function FlashToast({ message, param = "aviso" }: { message?: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams.has(param)) return;
    // id fixo: o efeito duplicado do Strict Mode não gera dois toasts.
    if (message) toast(message, { toastId: `flash-${param}` });
    const rest = new URLSearchParams(searchParams);
    rest.delete(param);
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [message, param, pathname, router, searchParams]);

  return null;
}

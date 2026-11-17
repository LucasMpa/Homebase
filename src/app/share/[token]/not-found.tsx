import { LinkIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Logo } from "@/components/layout/logo";

/** Link inexistente, expirado ou revogado: a mesma mensagem para todos, sem revelar o motivo. */
export default function ShareNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-8 md:py-10">
      <header className="mb-8">
        <Logo />
      </header>
      <EmptyState
        icon={LinkIcon}
        title="Link indisponível"
        description="Este link não existe, expirou ou foi desativado. Peça um novo a quem te enviou."
      />
    </div>
  );
}

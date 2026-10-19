import { SearchXIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Conta não encontrada"
      description="Ela pode ter sido excluída."
      action={
        <Link href="/contas" className={buttonVariants({ variant: "outline" })}>
          Ver contas
        </Link>
      }
    />
  );
}

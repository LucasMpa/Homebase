import { SearchXIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Lançamento não encontrado"
      description="Ele pode ter sido excluído."
      action={
        <Link href="/transactions" className={buttonVariants({ variant: "outline" })}>
          Ver lançamentos
        </Link>
      }
    />
  );
}

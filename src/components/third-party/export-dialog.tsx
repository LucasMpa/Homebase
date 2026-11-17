"use client";

import { CopyIcon, DownloadIcon, FileDownIcon, LinkIcon, Share2Icon, Trash2Icon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { describedBy, FormField } from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { formatDate, formatMonth } from "@/lib/format";
import { todayInSaoPaulo } from "@/lib/recurrence";
import { addMonths } from "@/lib/third-party";
import { periodLabel, SHARE_TTL_DAYS } from "@/lib/third-party-report";
import { cn } from "@/lib/utils";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/common";
import { exportParamsSchema, shareLinkSchema } from "@/lib/validation/third-party-export";
import type { ShareSummary } from "@/server/third-party-shares";
import { createShareLink, revokeShareLink } from "@/server/third-party-share-actions";

const ALL = "__all__";

/**
 * "Exportar": baixa o PDF das parcelas (de uma pessoa ou de todas) num período
 * e gera links públicos de compartilhamento (sempre de uma pessoa só).
 */
export function ExportDialog({
  people,
  currentMonth,
  shares,
}: {
  people: string[];
  currentMonth: string;
  shares: ShareSummary[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState(people.length === 1 ? people[0] : ALL);
  // Período padrão: só o mês atual (de e até), a cada vez que o diálogo abre.
  const [from, setFrom] = useState(currentMonth);
  const [to, setTo] = useState(currentMonth);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Opções de mês: 2 anos para trás e 4 para frente (cobre compras em até 48x).
  const monthOptions = Array.from({ length: 73 }, (_, i) => addMonths(currentMonth, i - 24));
  const monthItems = Object.fromEntries(monthOptions.map((m) => [m, formatMonth(m)]));
  const personItems = { [ALL]: "Todas as pessoas", ...Object.fromEntries(people.map((p) => [p, p])) };

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setFrom(currentMonth);
      setTo(currentMonth);
      setErrors({});
      setLink(null);
    }
  }

  function update(setter: (v: string) => void) {
    return (value: string | null) => {
      if (value === null) return;
      setter(value);
      setErrors({});
      setLink(null);
    };
  }

  const params = exportParamsSchema.safeParse({ person: person === ALL ? "" : person, from, to });
  const pdfHref = params.success
    ? `/third-party/export?${new URLSearchParams({ person: params.data.person ?? "", from, to })}`
    : undefined;

  function onDownload(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!params.success) {
      event.preventDefault();
      setErrors(fieldErrorsOf(params.error));
      return;
    }
    toast("Gerando PDF…");
  }

  function onCreateLink() {
    const parsed = shareLinkSchema.safeParse({ person: person === ALL ? "" : person, from, to });
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    startTransition(async () => {
      const result = await createShareLink(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      const url = `${window.location.origin}${result.path}`;
      setLink({ url, expiresAt: result.expiresAt });
      await copy(url);
    });
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast("Link gerado. Copie o endereço abaixo.");
    }
  }

  async function share(url: string) {
    try {
      await navigator.share({ title: `Resumo de ${person}`, url });
    } catch {
      // Cancelado pelo usuário: nada a fazer.
    }
  }

  const personId = `${id}-person`;
  const fromId = `${id}-from`;
  const toId = `${id}-to`;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FileDownIcon aria-hidden /> Exportar
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar gastos de terceiros</DialogTitle>
          <DialogDescription>Parcelas mês a mês, com o que já foi acertado e o que falta receber.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField id={personId} label="Pessoa" error={errors.person}>
            <Select items={personItems} value={person} onValueChange={update(setPerson)}>
              <SelectTrigger
                id={personId}
                className="w-full"
                aria-invalid={!!errors.person}
                aria-describedby={describedBy(personId, errors.person)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(personItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField id={fromId} label="De" error={errors.from}>
              <Select items={monthItems} value={from} onValueChange={update(setFrom)}>
                <SelectTrigger id={fromId} className="w-full" aria-invalid={!!errors.from} aria-describedby={describedBy(fromId, errors.from)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthItems[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id={toId} label="Até" error={errors.to}>
              <Select items={monthItems} value={to} onValueChange={update(setTo)}>
                <SelectTrigger id={toId} className="w-full" aria-invalid={!!errors.to} aria-describedby={describedBy(toId, errors.to)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthItems[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <a
              href={pdfHref}
              download
              onClick={onDownload}
              aria-disabled={!params.success}
              className={cn(buttonVariants(), "h-11 sm:h-10")}
            >
              <DownloadIcon aria-hidden /> Baixar PDF
            </a>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-10"
              onClick={onCreateLink}
              disabled={pending || person === ALL}
            >
              <LinkIcon aria-hidden /> {pending ? "Gerando…" : "Gerar link"}
            </Button>
          </div>
          {person === ALL && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Para gerar um link, escolha uma pessoa: cada link mostra só o que ela deve.
            </p>
          )}

          {link && (
            <div className="grid gap-2 rounded-lg bg-muted p-3 ring-1 ring-border">
              <p className="text-sm font-medium">Link de {person}</p>
              <Input readOnly value={link.url} aria-label="Endereço do link" onFocus={(e) => e.currentTarget.select()} />
              <div className="flex gap-2 *:flex-1">
                <Button type="button" size="sm" variant="outline" className="h-11 sm:h-9" onClick={() => copy(link.url)}>
                  <CopyIcon aria-hidden /> Copiar
                </Button>
                {canShare && (
                  <Button type="button" size="sm" variant="outline" className="h-11 sm:h-9" onClick={() => share(link.url)}>
                    <Share2Icon aria-hidden /> Compartilhar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Qualquer pessoa com o link vê os valores atualizados, sem login, até{" "}
                {formatDate(todayInSaoPaulo(new Date(link.expiresAt)))} ({SHARE_TTL_DAYS} dias).
              </p>
            </div>
          )}

          <ActiveShares shares={shares} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActiveShares({ shares }: { shares: ShareSummary[] }) {
  const [pending, startTransition] = useTransition();
  if (shares.length === 0) return null;

  function revoke(share: ShareSummary) {
    startTransition(async () => {
      const result = await revokeShareLink(share.id);
      if (result.ok) toast.success("Link desativado");
      else toast.error(result.message);
    });
  }

  return (
    <section aria-labelledby="active-shares" className="border-t border-border pt-4">
      <h3 id="active-shares" className="text-sm font-medium">
        Links ativos
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Por segurança, o endereço só aparece quando o link é gerado.</p>
      <ul className="mt-2 divide-y divide-border">
        {shares.map((share) => (
          <li key={share.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{share.person}</p>
              <p className="text-xs text-muted-foreground">
                {periodLabel(share.from, share.to)} · até {formatDate(todayInSaoPaulo(new Date(share.expiresAt)))}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-11 shrink-0 text-overdue-foreground sm:h-9"
              disabled={pending}
              onClick={() => revoke(share)}
              aria-label={`Desativar link de ${share.person} (${periodLabel(share.from, share.to)})`}
            >
              <Trash2Icon aria-hidden /> Desativar
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

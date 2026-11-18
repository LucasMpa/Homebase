import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildReminderEmail } from "@/features/bills/lib/reminder-email";
import {
  dueReminders,
  type Reminder,
  type ReminderBill,
  type ReminderKind,
  reminderWindow,
  type SentReminder,
  sentRecords,
} from "@/features/bills/lib/reminders";
import type { PaymentRecord } from "@/features/bills/lib/recurrence";
import type { PlainDate } from "@/lib/dates";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { type EmailMessage, sendEmail, type SentEmail } from "@/server/email";

/**
 * Job diário dos avisos de vencimento:
 * busca os dados → decide os avisos de hoje → monta o e-mail → envia → registra.
 *
 * Roda sem sessão de usuário: fala com o banco só pelas funções protegidas pelo
 * CRON_SECRET (get_reminder_data e record_bill_notifications), com a chave
 * publicável. Envia antes de registrar: se o registro falhar depois do envio,
 * o pior caso é um e-mail repetido no dia seguinte, nunca um aviso perdido.
 */

const KINDS = ["due_in_7", "due_in_3", "due_in_1", "due_today", "overdue"] as const satisfies readonly ReminderKind[];
const plainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const reminderDataSchema = z.object({
  email: z.string().min(3),
  bills: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      frequency: z.enum(["once", "weekly", "monthly", "yearly"]),
      startDate: plainDate,
      endDate: plainDate.nullable(),
      estimatedAmountCents: z.number().int().nullable(),
    }),
  ),
  payments: z.array(
    z.object({ billId: z.string(), dueDate: plainDate, paidAt: plainDate, amountCents: z.number().int() }),
  ),
  sent: z.array(z.object({ billId: z.string(), dueDate: plainDate, kind: z.enum(KINDS), sentOn: plainDate })),
});

export interface ReminderData {
  email: string;
  bills: ReminderBill[];
  payments: PaymentRecord[];
  sent: SentReminder[];
}

/** Valida e converte o JSON de get_reminder_data. */
export function parseReminderData(json: unknown): ReminderData {
  const data = reminderDataSchema.parse(json);
  return {
    email: data.email,
    bills: data.bills.map((b) => ({
      id: b.id,
      name: b.name,
      estimatedAmountCents: b.estimatedAmountCents,
      // A função só devolve contas ativas (archived_at nulo).
      rule: { frequency: b.frequency, startDate: b.startDate, endDate: b.endDate, archived: false },
    })),
    payments: data.payments,
    sent: data.sent,
  };
}

/** O que o job precisa do mundo lá fora (o banco e o envio); substituível nos testes. */
export interface ReminderJobDeps {
  /** Dados do período, ou null se o segredo não confere. */
  getData(from: PlainDate, to: PlainDate): Promise<ReminderData | null>;
  /** Registra os avisos enviados; devolve quantos foram gravados. */
  record(items: SentReminder[]): Promise<number>;
  send(message: EmailMessage): Promise<SentEmail>;
}

export type ReminderJobResult =
  | { status: "nothing"; today: PlainDate }
  | {
      status: "dry-run" | "sent";
      today: PlainDate;
      to: string;
      subject: string;
      reminders: { bill: string; dueDate: PlainDate; kind: ReminderKind; days: number }[];
      /** Só no dry-run, para conferir o e-mail sem enviar. */
      html?: string;
      sent?: SentEmail;
      recorded?: number;
    };

export class ReminderJobUnauthorizedError extends Error {
  constructor() {
    super("O banco recusou o segredo do job: confira o CRON_SECRET e rode `pnpm sync:cron-secret`.");
  }
}

function summarize(reminders: readonly Reminder[]) {
  return reminders.map((r) => ({ bill: r.bill.name, dueDate: r.dueDate, kind: r.kind, days: r.days }));
}

export async function runReminderJob(
  deps: ReminderJobDeps,
  { today, appUrl, dryRun = false }: { today: PlainDate; appUrl: string; dryRun?: boolean },
): Promise<ReminderJobResult> {
  const { from, to } = reminderWindow(today);
  const data = await deps.getData(from, to);
  if (!data) throw new ReminderJobUnauthorizedError();

  const reminders = dueReminders(data.bills, data.payments, data.sent, today);
  if (reminders.length === 0) return { status: "nothing", today };

  const email = buildReminderEmail(reminders, { today, appUrl });
  const base = { today, to: data.email, subject: email.subject, reminders: summarize(reminders) };
  if (dryRun) return { status: "dry-run", ...base, html: email.html };

  const sent = await deps.send({ to: data.email, ...email });
  const recorded = await deps.record(sentRecords(reminders, today));
  return { status: "sent", ...base, sent, recorded };
}

/** Dependências reais: funções do banco com a chave publicável + o segredo, e o envio configurado. */
export function createReminderJobDeps(secret: string): ReminderJobDeps {
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    async getData(from, to) {
      const { data, error } = await supabase.rpc("get_reminder_data", {
        job_secret: secret,
        from_date: from,
        to_date: to,
      });
      if (error) throw new Error(`get_reminder_data falhou: ${error.message}`);
      return data === null ? null : parseReminderData(data);
    },
    async record(items) {
      const { data, error } = await supabase.rpc("record_bill_notifications", {
        job_secret: secret,
        items: items as unknown as Database["public"]["Functions"]["record_bill_notifications"]["Args"]["items"],
      });
      if (error) throw new Error(`record_bill_notifications falhou: ${error.message}`);
      if (data === null) throw new ReminderJobUnauthorizedError();
      return data;
    },
    send: (message) => sendEmail(message),
  };
}

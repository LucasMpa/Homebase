import { describe, expect, it } from "vitest";
import type { PaymentRecord } from "./recurrence";
import {
  dueReminders,
  OVERDUE_LOOKBACK_DAYS,
  type ReminderBill,
  reminderWindow,
  type SentReminder,
  sentRecords,
} from "./reminders";

function bill(id: string, overrides: Partial<ReminderBill["rule"]> & { name?: string } = {}): ReminderBill {
  const { name = id, ...rule } = overrides;
  return {
    id,
    name,
    estimatedAmountCents: 100_00,
    rule: { frequency: "once", startDate: "2026-11-20", endDate: null, archived: false, ...rule },
  };
}

const paid = (billId: string, dueDate: string): PaymentRecord => ({
  billId,
  dueDate,
  paidAt: dueDate,
  amountCents: 100_00,
});

const sentOverdue = (billId: string, dueDate: string, sentOn: string): SentReminder => ({
  billId,
  dueDate,
  kind: "overdue",
  sentOn,
});

const summary = (r: ReturnType<typeof dueReminders>) => r.map((x) => `${x.bill.id}:${x.dueDate}:${x.kind}:${x.days}`);
const upcoming = (r: ReturnType<typeof dueReminders>) => summary(r.filter((x) => x.kind !== "overdue"));

describe("dueReminders: vencendo", () => {
  const b = bill("luz", { startDate: "2026-11-20" });

  it.each([
    ["2026-11-13", "due_in_7", 7],
    ["2026-11-17", "due_in_3", 3],
    ["2026-11-19", "due_in_1", 1],
    ["2026-11-20", "due_today", 0],
  ])("em %s avisa %s", (today, kind, days) => {
    expect(summary(dueReminders([b], [], [], today))).toEqual([`luz:2026-11-20:${kind}:${days}`]);
  });

  it.each(["2026-11-12", "2026-11-14", "2026-11-16", "2026-11-18"])("em %s (fora de 7/3/1/0) não avisa", (today) => {
    expect(dueReminders([b], [], [], today)).toEqual([]);
  });

  it("não repete um aviso já enviado", () => {
    const sent: SentReminder[] = [{ billId: "luz", dueDate: "2026-11-20", kind: "due_in_3", sentOn: "2026-11-17" }];
    expect(dueReminders([b], [], sent, "2026-11-17")).toEqual([]);
  });

  it("um aviso de outro tipo não bloqueia o de hoje", () => {
    const sent: SentReminder[] = [{ billId: "luz", dueDate: "2026-11-20", kind: "due_in_7", sentOn: "2026-11-13" }];
    expect(summary(dueReminders([b], [], sent, "2026-11-17"))).toEqual(["luz:2026-11-20:due_in_3:3"]);
  });

  it("conta paga não gera aviso", () => {
    expect(dueReminders([b], [paid("luz", "2026-11-20")], [], "2026-11-19")).toEqual([]);
  });

  it("conta arquivada não gera aviso", () => {
    expect(dueReminders([bill("x", { archived: true })], [], [], "2026-11-19")).toEqual([]);
  });

  it("conta mensal: avisa a parcela certa atravessando o ano", () => {
    // Só o aviso de vencimento; parcelas anteriores não pagas viram atrasadas (testadas abaixo).
    const aluguel = bill("aluguel", { frequency: "monthly", startDate: "2026-01-05" });
    expect(upcoming(dueReminders([aluguel], [], [], "2026-12-29"))).toEqual(["aluguel:2027-01-05:due_in_7:7"]);
  });

  it("dia 31 em mês curto: vence no último dia do mês", () => {
    const cartao = bill("cartao", { frequency: "monthly", startDate: "2026-01-31" });
    expect(upcoming(dueReminders([cartao], [], [], "2027-02-27"))).toEqual(["cartao:2027-02-28:due_in_1:1"]);
  });

  it("conta que terminou não gera aviso depois do fim", () => {
    // 10/12 estaria a 7 dias, mas a conta terminou em 10/11.
    const b2 = bill("curso", { frequency: "monthly", startDate: "2026-10-10", endDate: "2026-11-10" });
    const payments = [paid("curso", "2026-10-10"), paid("curso", "2026-11-10")];
    expect(dueReminders([b2], payments, [], "2026-12-03")).toEqual([]);
  });
});

describe("dueReminders: atrasadas", () => {
  const b = bill("agua", { startDate: "2026-11-10" });

  it("avisa no 1º dia de atraso", () => {
    expect(summary(dueReminders([b], [], [], "2026-11-11"))).toEqual(["agua:2026-11-10:overdue:1"]);
  });

  it("não repete antes de 7 dias do último aviso", () => {
    const sent = [sentOverdue("agua", "2026-11-10", "2026-11-11")];
    for (const today of ["2026-11-11", "2026-11-12", "2026-11-17"]) {
      expect(dueReminders([b], [], sent, today)).toEqual([]);
    }
  });

  it("repete 7 dias depois do último aviso", () => {
    const sent = [sentOverdue("agua", "2026-11-10", "2026-11-11")];
    expect(summary(dueReminders([b], [], sent, "2026-11-18"))).toEqual(["agua:2026-11-10:overdue:8"]);
  });

  it("job parado no dia da repetição: o aviso sai no dia seguinte", () => {
    const sent = [sentOverdue("agua", "2026-11-10", "2026-11-11")];
    expect(summary(dueReminders([b], [], sent, "2026-11-19"))).toEqual(["agua:2026-11-10:overdue:9"]);
  });

  it("conta como referência o aviso mais recente", () => {
    const sent = [sentOverdue("agua", "2026-11-10", "2026-11-11"), sentOverdue("agua", "2026-11-10", "2026-11-18")];
    expect(dueReminders([b], [], sent, "2026-11-24")).toEqual([]);
    expect(dueReminders([b], [], sent, "2026-11-25")).toHaveLength(1);
  });

  it("job parado no 1º dia de atraso: avisa no dia seguinte", () => {
    expect(summary(dueReminders([b], [], [], "2026-11-13"))).toEqual(["agua:2026-11-10:overdue:3"]);
  });

  it("paga depois de atrasar: para de avisar", () => {
    expect(dueReminders([b], [paid("agua", "2026-11-10")], [], "2026-11-18")).toEqual([]);
  });

  it(`ignora atrasos com mais de ${OVERDUE_LOOKBACK_DAYS} dias`, () => {
    const today = "2027-01-20";
    const { from } = reminderWindow(today);
    expect(from).toBe("2026-11-21");
    expect(dueReminders([bill("velha", { startDate: "2026-11-20" })], [], [], today)).toEqual([]);
    expect(dueReminders([bill("limite", { startDate: "2026-11-21" })], [], [], today)).toHaveLength(1);
  });

  it("conta semanal atrasada: cada parcela tem o seu aviso", () => {
    const semanal = bill("faxina", { frequency: "weekly", startDate: "2026-11-02" });
    // 02/11 paga; 09/11 e 16/11 atrasadas; 23/11 vence em 6 dias (sem aviso).
    expect(summary(dueReminders([semanal], [paid("faxina", "2026-11-02")], [], "2026-11-17"))).toEqual([
      "faxina:2026-11-09:overdue:8",
      "faxina:2026-11-16:overdue:1",
    ]);
  });
});

describe("dueReminders: ordem e registros", () => {
  it("ordena por urgência: atrasadas, hoje, 1, 3 e 7 dias; depois por data e nome", () => {
    const today = "2026-11-17";
    const bills = [
      bill("internet", { startDate: "2026-11-24" }),
      bill("luz", { startDate: "2026-11-20" }),
      bill("gas", { startDate: "2026-11-17" }),
      bill("agua", { startDate: "2026-11-18" }),
      bill("aluguel", { startDate: "2026-11-10" }),
      bill("condominio", { startDate: "2026-11-10", name: "Condomínio" }),
    ];
    expect(dueReminders(bills, [], [], today).map((r) => `${r.bill.id}:${r.kind}`)).toEqual([
      "aluguel:overdue",
      "condominio:overdue",
      "gas:due_today",
      "agua:due_in_1",
      "luz:due_in_3",
      "internet:due_in_7",
    ]);
  });

  it("sentRecords grava o que saiu, com a data de hoje", () => {
    const reminders = dueReminders([bill("luz", { startDate: "2026-11-20" })], [], [], "2026-11-17");
    expect(sentRecords(reminders, "2026-11-17")).toEqual([
      { billId: "luz", dueDate: "2026-11-20", kind: "due_in_3", sentOn: "2026-11-17" },
    ]);
  });

  it("rodar duas vezes no mesmo dia não gera avisos novos", () => {
    const today = "2026-11-17";
    const bills = [bill("luz", { startDate: "2026-11-20" }), bill("agua", { startDate: "2026-11-10" })];
    const first = dueReminders(bills, [], [], today);
    expect(first).toHaveLength(2);
    expect(dueReminders(bills, [], sentRecords(first, today), today)).toEqual([]);
  });
});

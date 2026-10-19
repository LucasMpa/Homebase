import { describe, expect, it } from "vitest";
import { buildMonthSummary, buildMonthView, buildWeekView, type PaymentRecord, type SchedulableBill } from "@/lib/recurrence";

const bill = (
  id: string,
  frequency: SchedulableBill["rule"]["frequency"],
  startDate: string,
  estimatedAmountCents: number | null,
  extra: Partial<SchedulableBill["rule"]> = {},
): SchedulableBill => ({
  id,
  estimatedAmountCents,
  rule: { frequency, startDate, endDate: null, archived: false, ...extra },
});

const pay = (billId: string, dueDate: string, amountCents: number, paidAt = dueDate): PaymentRecord => ({
  billId,
  dueDate,
  paidAt,
  amountCents,
});

const today = "2026-10-15";

describe("buildWeekView", () => {
  it("separa atrasadas, vence hoje e próximos 7 dias", () => {
    const bills = [
      bill("luz", "monthly", "2026-01-10", 20000),
      bill("agua", "monthly", "2026-09-15", 8000),
      bill("feira", "weekly", "2026-10-01", null),
    ];
    const view = buildWeekView(bills, [pay("luz", "2026-01-10", 20000)], today);

    // luz: fev..out sem pagamento (jan paga); feira: 01/10 e 08/10
    expect(view.overdue.map((o) => `${o.bill.id}:${o.dueDate}`)).toEqual([
      "luz:2026-02-10",
      "luz:2026-03-10",
      "luz:2026-04-10",
      "luz:2026-05-10",
      "luz:2026-06-10",
      "luz:2026-07-10",
      "luz:2026-08-10",
      "luz:2026-09-10",
      "agua:2026-09-15",
      "feira:2026-10-01",
      "feira:2026-10-08",
      "luz:2026-10-10",
    ]);
    expect(view.dueToday.map((o) => `${o.bill.id}:${o.dueDate}`)).toEqual(["agua:2026-10-15", "feira:2026-10-15"]);
    expect(view.nextSevenDays.map((o) => `${o.bill.id}:${o.dueDate}`)).toEqual(["feira:2026-10-22"]);
  });

  it("paga hoje sai de 'vence hoje'; paga adiantada aparece nos próximos dias como paga", () => {
    const bills = [bill("a", "once", "2026-10-15", 100), bill("b", "once", "2026-10-20", 100)];
    const view = buildWeekView(bills, [pay("a", "2026-10-15", 100), pay("b", "2026-10-20", 100, "2026-10-14")], today);
    expect(view.dueToday).toEqual([]);
    expect(view.nextSevenDays.map((o) => o.status)).toEqual(["paid"]);
  });

  it("contas arquivadas não aparecem", () => {
    const view = buildWeekView([bill("x", "monthly", "2026-01-01", 1, { archived: true })], [], today);
    expect(view.overdue).toEqual([]);
  });
});

describe("buildMonthSummary", () => {
  it("usa valor pago, senão estimado, e conta ocorrências sem valor à parte", () => {
    const bills = [
      bill("luz", "monthly", "2026-01-10", 20000), // paga com 21500
      bill("agua", "monthly", "2026-01-20", 8000), // estimado
      bill("feira", "weekly", "2026-10-01", null), // 5 ocorrências em out/2026, 1 paga
    ];
    const payments = [pay("luz", "2026-10-10", 21500), pay("feira", "2026-10-08", 30000, "2026-10-09")];
    expect(buildMonthSummary(bills, payments, today)).toEqual({
      expectedCents: 21500 + 8000 + 30000,
      withoutAmountCount: 4,
      paidCents: 21500 + 30000,
    });
  });

  it("total pago considera a data de pagamento, não o vencimento", () => {
    const bills = [bill("luz", "monthly", "2026-09-10", 10000)];
    const payments = [pay("luz", "2026-09-10", 10000, "2026-10-02")];
    expect(buildMonthSummary(bills, payments, today)).toEqual({
      expectedCents: 10000,
      withoutAmountCount: 0,
      paidCents: 10000,
    });
  });
});

describe("buildMonthView", () => {
  const bills = [
    bill("luz", "monthly", "2026-01-10", 20000),
    bill("agua", "monthly", "2026-09-20", 8000),
    bill("net", "monthly", "2026-01-25", null),
    bill("seguro", "yearly", "2026-03-01", 50000),
  ];

  it("separa pagas e pendentes do mês e soma os valores", () => {
    const view = buildMonthView(
      bills,
      [pay("luz", "2026-10-10", 19876, "2026-10-09"), pay("luz", "2026-09-10", 20000)],
      today,
      today,
    );
    expect(view.paid.map((o) => o.bill.id)).toEqual(["luz"]);
    expect(view.paidCents).toBe(19876);
    expect(view.pending.map((o) => `${o.bill.id}:${o.dueDate}`)).toEqual(["agua:2026-10-20", "net:2026-10-25"]);
    expect(view.pendingCents).toBe(8000);
    expect(view.pendingWithoutAmountCount).toBe(1);
    expect(view.otherPayments).toEqual([]);
  });

  it("lista pagamentos feitos no mês para vencimentos de outros meses", () => {
    const late = pay("agua", "2026-09-20", 8000, "2026-10-02");
    const early = pay("luz", "2026-11-10", 20000, "2026-10-14");
    const view = buildMonthView(bills, [late, early, pay("luz", "2026-10-10", 20000)], today, today);
    expect(view.otherPayments).toEqual([late, early]);
    expect(view.paid).toHaveLength(1);
  });

  it("aceita qualquer dia do mês como referência e marca atrasadas em meses passados", () => {
    const view = buildMonthView(bills, [], "2026-09-30", today);
    expect(view.pending.map((o) => [o.bill.id, o.status])).toEqual([
      ["luz", "overdue"],
      ["agua", "overdue"],
      ["net", "overdue"],
    ]);
  });
});

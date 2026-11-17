import { describe, expect, it } from "vitest";
import { monthlyOverview, type ThirdPartyExpense } from "@/lib/third-party";
import { buildExportReport, monthSpan, periodLabel, reportFileName, slugify } from "@/lib/third-party-report";
import { exportParamsSchema, shareLinkSchema, shareTokenSchema } from "@/lib/validation/third-party-export";

function expense(overrides: Partial<ThirdPartyExpense>): ThirdPartyExpense {
  return {
    id: crypto.randomUUID(),
    person: "Ana",
    description: "Compra",
    amountCents: 1000,
    purchaseDate: "2026-10-01",
    installments: 1,
    notes: null,
    settlements: [],
    ...overrides,
  };
}

describe("monthSpan", () => {
  it("conta os meses inclusive, atravessando o ano", () => {
    expect(monthSpan("2026-11", "2026-11")).toBe(1);
    expect(monthSpan("2026-11", "2027-04")).toBe(6);
    expect(monthSpan("2026-01", "2027-12")).toBe(24);
  });
});

describe("buildExportReport", () => {
  const tv = expense({
    id: "tv",
    description: "TV",
    amountCents: 100_00,
    installments: 3,
    purchaseDate: "2026-10-15",
    settlements: [{ installment: 1, amountCents: 33_34, settledAt: "2026-10-20" }],
  });
  const lunch = expense({ id: "lunch", description: "Almoço", amountCents: 50_00, purchaseDate: "2026-11-03" });
  const bruno = expense({ id: "bruno", person: "Bruno", description: "Tênis", amountCents: 300_00, purchaseDate: "2026-11-05", installments: 2 });

  it("separa acertadas, pendentes e atrasadas, mês a mês", () => {
    const report = buildExportReport([tv, lunch, bruno], {
      person: "Ana",
      from: "2026-10",
      to: "2027-01",
      currentMonth: "2026-11",
    });
    expect(report.person).toBe("Ana");
    expect(report.months.map((m) => m.month)).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);

    const [oct, nov, dec, jan] = report.months;
    expect(oct.lines).toMatchObject([{ number: 1, of: 3, cents: 33_34, status: "settled", settledAt: "2026-10-20" }]);
    // Mesma pessoa: a compra mais antiga primeiro.
    expect(nov.lines.map((l) => [l.description, l.cents, l.status])).toEqual([
      ["TV", 33_33, "pending"],
      ["Almoço", 50_00, "pending"],
    ]);
    expect(dec.lines).toMatchObject([{ description: "TV", number: 3, cents: 33_33, status: "pending" }]);
    expect(jan.lines).toEqual([]);
    expect(jan.totalCents).toBe(0);

    expect(report.totals).toEqual({
      totalCents: 100_00 + 50_00,
      settledCents: 33_34,
      pendingCents: 33_33 + 33_33 + 50_00,
      overdueCents: 0,
    });
  });

  it("marca como atrasada a parcela pendente de mês anterior ao atual", () => {
    const report = buildExportReport([tv], { person: "Ana", from: "2026-10", to: "2026-12", currentMonth: "2027-01" });
    expect(report.months[1].lines[0].status).toBe("overdue");
    expect(report.months[2].lines[0].status).toBe("overdue");
    expect(report.totals.overdueCents).toBe(33_33 * 2);
  });

  it("soma à parte o pendente de antes do período", () => {
    const report = buildExportReport([tv], { person: "Ana", from: "2026-12", to: "2026-12", currentMonth: "2026-12" });
    // Parcela 1 (out) acertada não conta; a 2 (nov) está pendente e atrasada.
    expect(report.earlier).toEqual({ cents: 33_33, count: 1, overdue: true });
    expect(report.totals.totalCents).toBe(33_33);
  });

  it("link público: usa as pendências anteriores já agregadas pelo banco", () => {
    const report = buildExportReport([], {
      person: "Ana",
      from: "2026-12",
      to: "2026-12",
      currentMonth: "2026-12",
      earlierPending: { cents: 30_00, count: 2, firstMonth: "2026-08" },
    });
    expect(report.earlier).toEqual({ cents: 30_00, count: 2, overdue: true });

    const notYetDue = buildExportReport([], {
      person: "Ana",
      from: "2027-03",
      to: "2027-03",
      currentMonth: "2026-12",
      earlierPending: { cents: 10_00, count: 1, firstMonth: "2027-01" },
    });
    expect(notYetDue.earlier.overdue).toBe(false);

    const none = buildExportReport([tv], {
      person: "Ana",
      from: "2026-12",
      to: "2026-12",
      currentMonth: "2026-12",
      earlierPending: { cents: 0, count: 0, firstMonth: null },
    });
    expect(none.earlier).toEqual({ cents: 0, count: 0, overdue: false });
  });

  it("filtra a pessoa ignorando caixa e espaços, e usa o nome cadastrado", () => {
    const report = buildExportReport([tv, bruno], { person: "  ana ", from: "2026-10", to: "2026-12", currentMonth: "2026-11" });
    expect(report.person).toBe("Ana");
    expect(report.months.flatMap((m) => m.lines).every((l) => l.person === "Ana")).toBe(true);
  });

  it("pessoa sem gastos: relatório zerado com o nome pedido", () => {
    const report = buildExportReport([tv], { person: "Carla", from: "2026-10", to: "2026-11", currentMonth: "2026-11" });
    expect(report.person).toBe("Carla");
    expect(report.totals.totalCents).toBe(0);
    expect(report.months).toHaveLength(2);
  });

  it("todas as pessoas: ordena por pessoa e bate com o monthlyOverview no pendente", () => {
    const expenses = [tv, lunch, bruno];
    const report = buildExportReport(expenses, { person: null, from: "2026-11", to: "2027-04", currentMonth: "2026-11" });
    expect(report.person).toBeNull();
    expect(report.months[0].lines.map((l) => l.person)).toEqual(["Ana", "Ana", "Bruno"]);

    const overview = monthlyOverview(expenses, "2026-11", 6);
    expect(report.months.map((m) => m.pendingCents)).toEqual(overview.months.map((m) => m.totalCents));
    expect(report.earlier.cents).toBe(overview.before);
  });

  it("a soma das parcelas de uma compra é sempre o total", () => {
    const odd = expense({ amountCents: 100_01, installments: 7, purchaseDate: "2026-01-31" });
    const report = buildExportReport([odd], { person: null, from: "2026-01", to: "2026-12", currentMonth: "2026-01" });
    expect(report.totals.totalCents).toBe(100_01);
  });
});

describe("nomes e rótulos", () => {
  it("periodLabel", () => {
    expect(periodLabel("2026-11", "2026-11")).toBe("nov/2026");
    expect(periodLabel("2026-11", "2027-04")).toBe("nov/2026 a abr/2027");
  });

  it("slugify remove acentos e símbolos", () => {
    expect(slugify("João  da Conceição!")).toBe("joao-da-conceicao");
    expect(slugify("***")).toBe("todos");
  });

  it("reportFileName", () => {
    expect(reportFileName({ person: "Ana Maria", from: "2026-11", to: "2027-04" })).toBe(
      "homebase-terceiros-ana-maria-2026-11-a-2027-04.pdf",
    );
    expect(reportFileName({ person: null, from: "2026-11", to: "2026-11" })).toBe("homebase-terceiros-todos-2026-11.pdf");
  });
});

describe("validação da exportação", () => {
  it("aceita pessoa vazia como todas", () => {
    expect(exportParamsSchema.parse({ person: "", from: "2026-11", to: "2027-04" })).toEqual({
      person: null,
      from: "2026-11",
      to: "2027-04",
    });
  });

  it("recusa período invertido, longo demais ou mês malformado", () => {
    expect(exportParamsSchema.safeParse({ from: "2027-01", to: "2026-12" }).success).toBe(false);
    expect(exportParamsSchema.safeParse({ from: "2026-01", to: "2028-01" }).success).toBe(false);
    expect(exportParamsSchema.safeParse({ from: "2026-13", to: "2026-12" }).success).toBe(false);
    expect(exportParamsSchema.safeParse({ from: "1999-01", to: "1999-02" }).success).toBe(false);
    expect(exportParamsSchema.safeParse({ from: "2026-01", to: "2027-12" }).success).toBe(true);
  });

  it("link exige uma pessoa", () => {
    expect(shareLinkSchema.safeParse({ person: " ", from: "2026-11", to: "2026-11" }).success).toBe(false);
    expect(shareLinkSchema.safeParse({ person: "Ana", from: "2026-11", to: "2026-11" }).success).toBe(true);
  });

  it("token: 43 caracteres base64url", () => {
    expect(shareTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(shareTokenSchema.safeParse("a".repeat(42)).success).toBe(false);
    expect(shareTokenSchema.safeParse(`${"a".repeat(42)}/`).success).toBe(false);
  });
});

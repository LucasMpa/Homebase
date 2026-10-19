import { describe, expect, it } from "vitest";
import {
  addMonths,
  groupByPerson,
  installmentCents,
  installmentSchedule,
  isSettled,
  monthlyOverview,
  monthlyTotals,
  pendingCents,
  pendingInstallments,
  personKey,
  settledOn,
  uniqueSuggestions,
  type ThirdPartyExpense,
} from "@/lib/third-party";
import { expenseFormSchema, settleSchema } from "@/lib/validation/third-party";

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

describe("groupByPerson", () => {
  it("agrupa ignorando caixa e espaços, somando os valores", () => {
    const groups = groupByPerson([
      expense({ person: "Ana", amountCents: 1000, purchaseDate: "2026-10-01" }),
      expense({ person: " ana ", amountCents: 2500, purchaseDate: "2026-10-05" }),
      expense({ person: "Bruno", amountCents: 5000 }),
    ]);
    expect(groups.map((g) => [g.person, g.totalCents, g.expenses.length])).toEqual([
      ["Bruno", 5000, 1],
      ["ana", 3500, 2],
    ]);
  });

  it("ordena os gastos do grupo do mais recente para o mais antigo", () => {
    const [group] = groupByPerson([
      expense({ description: "antigo", purchaseDate: "2026-09-01" }),
      expense({ description: "novo", purchaseDate: "2026-10-10" }),
    ]);
    expect(group.expenses.map((e) => e.description)).toEqual(["novo", "antigo"]);
  });

  it("lista vazia não gera grupos", () => {
    expect(groupByPerson([])).toEqual([]);
  });
});

describe("helpers", () => {
  it("personKey normaliza", () => {
    expect(personKey("  Maria   Clara ")).toBe("maria clara");
  });

  it("installmentCents arredonda e nunca divide por zero", () => {
    expect(installmentCents(10000, 3)).toBe(3333);
    expect(installmentCents(10000, 0)).toBe(10000);
  });

  it("uniqueSuggestions remove vazios e duplicados", () => {
    expect(uniqueSuggestions(["Nubank", "nubank", null, " ", "Itaú"])).toEqual(["Itaú", "Nubank"]);
  });
});

describe("expenseFormSchema", () => {
  const valid = {
    person: "Ana",
    description: "Farmácia",
    amount: "123,45",
    purchaseDate: "2026-10-15",
    installments: "",
    notes: "",
  };

  it("converte valores e aplica padrões", () => {
    expect(expenseFormSchema.parse(valid)).toEqual({
      person: "Ana",
      description: "Farmácia",
      amount: 12345,
      purchaseDate: "2026-10-15",
      installments: 1,
      notes: null,
    });
  });

  it.each([
    [{ amount: "" }, "amount"],
    [{ amount: "0" }, "amount"],
    [{ person: "  " }, "person"],
    [{ installments: "0" }, "installments"],
    [{ installments: "49" }, "installments"],
    [{ installments: "2,5" }, "installments"],
    [{ purchaseDate: "15/10/2026" }, "purchaseDate"],
  ])("rejeita %o", (override, field) => {
    const result = expenseFormSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path[0]).toBe(field);
  });
});

describe("settleSchema", () => {
  const item = () => ({ expenseId: crypto.randomUUID(), installment: 1 });

  it("exige ao menos uma parcela e data não futura", () => {
    expect(settleSchema.safeParse({ items: [], settledAt: "2026-01-01" }).success).toBe(false);
    expect(settleSchema.safeParse({ items: [item()], settledAt: "2099-01-01" }).success).toBe(false);
    expect(settleSchema.safeParse({ items: [item()], settledAt: "2026-01-01" }).success).toBe(true);
  });

  it("recusa número de parcela inválido", () => {
    const bad = { expenseId: crypto.randomUUID(), installment: 0 };
    expect(settleSchema.safeParse({ items: [bad], settledAt: "2026-01-01" }).success).toBe(false);
  });
});

describe("acerto por parcela", () => {
  // R$ 800 em 3x a partir de out/2026: 266,68 + 266,66 + 266,66.
  const paula = (settled: number[] = []) =>
    expense({
      amountCents: 80000,
      installments: 3,
      purchaseDate: "2026-10-19",
      settlements: settled.map((n, i) => ({
        installment: n,
        amountCents: n === 1 ? 26668 : 26666,
        settledAt: `2026-1${i}-05`,
      })),
    });

  it("sem acertos, todas as parcelas estão pendentes", () => {
    expect(pendingInstallments(paula()).map((i) => [i.number, i.cents])).toEqual([
      [1, 26668],
      [2, 26666],
      [3, 26666],
    ]);
    expect(pendingCents(paula())).toBe(80000);
    expect(isSettled(paula())).toBe(false);
    expect(settledOn(paula())).toBeNull();
  });

  it("acertar a 1ª parcela deixa as outras duas", () => {
    expect(pendingInstallments(paula([1])).map((i) => i.number)).toEqual([2, 3]);
    expect(pendingCents(paula([1]))).toBe(53332);
    expect(isSettled(paula([1]))).toBe(false);
  });

  it("parcelas acertadas fora de ordem também contam", () => {
    expect(pendingInstallments(paula([3])).map((i) => i.number)).toEqual([1, 2]);
  });

  it("com todas acertadas, o gasto está acertado na data do último acerto", () => {
    const done = paula([1, 2, 3]);
    expect(isSettled(done)).toBe(true);
    expect(pendingCents(done)).toBe(0);
    expect(settledOn(done)).toBe("2026-12-05");
  });

  it("monthlyTotals e monthlyOverview ignoram parcelas acertadas", () => {
    expect(Object.fromEntries(monthlyTotals([paula([1])]))).toEqual({ "2026-11": 26666, "2026-12": 26666 });
    const { months } = monthlyOverview([paula([2])], "2026-10", 3);
    expect(months.map((m) => m.totalCents)).toEqual([26668, 0, 26666]);
  });

  it("groupByPerson pode somar só o pendente", () => {
    const [group] = groupByPerson([paula([1])], pendingCents);
    expect(group.totalCents).toBe(53332);
  });
});

describe("custo mensal", () => {
  it("addMonths atravessa anos", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("installmentSchedule soma o total e põe a sobra na 1ª parcela", () => {
    const schedule = installmentSchedule({ amountCents: 10000, installments: 3, purchaseDate: "2026-11-20" });
    expect(schedule).toEqual([
      { month: "2026-11", number: 1, cents: 3334 },
      { month: "2026-12", number: 2, cents: 3333 },
      { month: "2027-01", number: 3, cents: 3333 },
    ]);
  });

  it("compra à vista cai inteira no mês da compra", () => {
    expect(installmentSchedule({ amountCents: 500, installments: 1, purchaseDate: "2026-10-15" })).toEqual([
      { month: "2026-10", number: 1, cents: 500 },
    ]);
  });

  it("monthlyTotals soma parcelas de várias compras", () => {
    const totals = monthlyTotals([
      expense({ amountCents: 3000, installments: 3, purchaseDate: "2026-10-01" }),
      expense({ amountCents: 500, purchaseDate: "2026-11-10" }),
    ]);
    expect(Object.fromEntries(totals)).toEqual({ "2026-10": 1000, "2026-11": 1500, "2026-12": 1000 });
  });

  it("monthlyOverview separa antes, janela e depois, por pessoa", () => {
    const overview = monthlyOverview(
      [
        expense({ person: "Ana", amountCents: 4000, installments: 4, purchaseDate: "2026-09-05" }),
        expense({ person: "ana", amountCents: 700, purchaseDate: "2026-10-02" }),
        expense({ person: "Bruno", amountCents: 200, purchaseDate: "2026-11-02" }),
      ],
      "2026-10",
      2,
    );
    expect(overview.before).toBe(1000);
    expect(overview.after).toBe(1000);
    expect(overview.months).toEqual([
      { month: "2026-10", totalCents: 1700, byPerson: [{ person: "Ana", cents: 1700 }] },
      {
        month: "2026-11",
        totalCents: 1200,
        byPerson: [
          { person: "Ana", cents: 1000 },
          { person: "Bruno", cents: 200 },
        ],
      },
    ]);
  });
});

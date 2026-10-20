import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/format";
import { monthsEndingAt } from "@/lib/months";
import { niceMax, OTHER_CATEGORIES, paidByCategory, paidByMonth, totalsByKind, type LedgerEntry } from "@/lib/reports";

/** Lançamento de teste: com `billId` é pagamento de conta; sem, gasto avulso. */
const entry = (paidAt: string, amountCents: number, category: Category, billId: string | null = null): LedgerEntry => ({
  paidAt,
  amountCents,
  category,
  billId,
});

describe("monthsEndingAt", () => {
  it("conta para trás atravessando o ano", () => {
    expect(monthsEndingAt("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("paidByMonth", () => {
  it("soma contas e avulsos pela data em que o dinheiro saiu e ignora meses fora da janela", () => {
    const result = paidByMonth(
      [
        entry("2026-09-05", 1000, "housing", "a"),
        entry("2026-09-30", 500, "leisure"),
        entry("2026-10-01", 200, "utilities", "b"),
        entry("2026-10-19", 18000, "leisure"),
        entry("2026-01-01", 9, "other"),
      ],
      ["2026-08", "2026-09", "2026-10"],
    );
    expect(result).toEqual([
      { month: "2026-08", cents: 0, count: 0 },
      { month: "2026-09", cents: 1500, count: 2 },
      { month: "2026-10", cents: 18200, count: 2 },
    ]);
  });
});

describe("paidByCategory", () => {
  it("agrupa pela categoria gravada no lançamento, somando contas e avulsos (cenário E8)", () => {
    const result = paidByCategory(
      [entry("2026-10-10", 20000, "utilities", "luz"), entry("2026-10-19", 18000, "leisure")],
      "2026-10",
      "2026-10",
    );
    expect(result).toEqual([
      { key: "utilities", label: "Contas de consumo", cents: 20000 },
      { key: "leisure", label: "Lazer", cents: 18000 },
    ]);
    const total = result.reduce((s, c) => s + c.cents, 0);
    expect(result.map((c) => Math.round((c.cents / total) * 100))).toEqual([53, 47]);
  });

  it("filtra o período e soma lançamentos da mesma categoria", () => {
    const result = paidByCategory(
      [
        entry("2026-08-31", 999, "housing", "x"),
        entry("2026-09-01", 1000, "housing", "x"),
        entry("2026-10-31", 500, "housing"),
        entry("2026-11-01", 999, "housing"),
      ],
      "2026-09",
      "2026-10",
    );
    expect(result).toEqual([{ key: "housing", label: "Moradia", cents: 1500 }]);
  });

  it("desempata pelo nome da categoria em pt-BR", () => {
    const result = paidByCategory(
      [entry("2026-10-01", 100, "travel"), entry("2026-10-01", 100, "food"), entry("2026-10-01", 100, "education")],
      "2026-10",
      "2026-10",
    );
    expect(result.map((c) => c.label)).toEqual(["Alimentação", "Educação", "Viagem"]);
  });

  it("junta a cauda em Outras quando passa do limite", () => {
    const categories: Category[] = ["housing", "health", "leisure", "shopping"];
    const entries = categories.map((c, i) => entry("2026-10-01", 1000 - i * 100, c));
    expect(paidByCategory(entries, "2026-10", "2026-10", 3)).toEqual([
      { key: "housing", label: "Moradia", cents: 1000 },
      { key: "health", label: "Saúde", cents: 900 },
      { key: "outras", label: OTHER_CATEGORIES, cents: 1500 },
    ]);
  });

  it("com o limite padrão, todas as categorias cabem e não há Outras", () => {
    const entries = (
      ["housing", "utilities", "internet", "subscriptions", "food", "home", "health", "education", "transportation", "leisure", "shopping", "travel", "taxes", "insurance", "other"] as const
    ).map((c, i) => entry("2026-10-01", 100 + i, c));
    const result = paidByCategory(entries, "2026-10", "2026-10");
    expect(result).toHaveLength(15);
    expect(result.some((c) => c.key === "outras")).toBe(false);
  });
});

describe("totalsByKind", () => {
  it("separa pagamentos de conta e avulsos dentro do período", () => {
    const entries = [
      entry("2026-10-10", 20000, "utilities", "luz"),
      entry("2026-10-19", 18000, "leisure"),
      entry("2026-10-01", 0, "utilities", "agua"),
      entry("2026-09-30", 5000, "leisure"),
    ];
    expect(totalsByKind(entries, "2026-10", "2026-10")).toEqual({ billsCents: 20000, oneOffCents: 18000 });
    expect(totalsByKind(entries, "2026-09", "2026-10")).toEqual({ billsCents: 20000, oneOffCents: 23000 });
  });
});

describe("niceMax", () => {
  it.each([
    [0, 10000],
    [12345, 20000],
    [230000, 250000],
    [480000, 500000],
    [100000, 100000],
    [610000, 1000000],
  ])("niceMax(%i) = %i", (input, expected) => {
    expect(niceMax(input)).toBe(expected);
  });
});

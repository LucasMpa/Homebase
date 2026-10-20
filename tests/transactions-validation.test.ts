import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fieldErrorsOf } from "@/lib/validation/common";
import { transactionFormSchema, type TransactionFormValues } from "@/lib/validation/transactions";

const valid: TransactionFormValues = {
  description: "Ingresso do show",
  amount: "180",
  paidAt: "2026-10-19",
  category: "leisure",
  notes: "",
};

const errorsOf = (overrides: Partial<TransactionFormValues>) => {
  const parsed = transactionFormSchema.safeParse({ ...valid, ...overrides });
  return parsed.success ? {} : fieldErrorsOf(parsed.error);
};

describe("transactionFormSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 19/10/2026, 12h em São Paulo.
    vi.setSystemTime(new Date("2026-10-19T15:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("aceita o ingresso de hoje e converte para centavos (cenário A5)", () => {
    expect(transactionFormSchema.parse(valid)).toEqual({
      description: "Ingresso do show",
      amount: 18000,
      paidAt: "2026-10-19",
      category: "leisure",
      notes: null,
    });
  });

  it.each([
    ["180,00", 18000],
    ["1.234,56", 123456],
  ])("aceita o valor %s", (amount, cents) => {
    expect(transactionFormSchema.parse({ ...valid, amount }).amount).toBe(cents);
  });

  it("rejeita valor vazio, zero e malformado", () => {
    expect(errorsOf({ amount: "" }).amount).toBe("Informe o valor");
    expect(errorsOf({ amount: "0" }).amount).toBe("O valor precisa ser maior que zero");
    expect(errorsOf({ amount: "12,345" }).amount).toBe("Valor inválido. Use o formato 1.234,56");
  });

  it("rejeita data futura e aceita hoje", () => {
    expect(errorsOf({ paidAt: "2026-10-20" }).paidAt).toBe("A data não pode ser no futuro");
    expect(errorsOf({ paidAt: "2026-10-19" }).paidAt).toBeUndefined();
    expect(errorsOf({ paidAt: "" }).paidAt).toBe("Informe a data");
    expect(errorsOf({ paidAt: "1999-12-31" }).paidAt).toBe("Use um ano entre 2000 e 2100");
  });

  it("usa o dia de São Paulo, não o UTC", () => {
    // 20/10 01h UTC ainda é 19/10 em São Paulo.
    vi.setSystemTime(new Date("2026-10-20T01:00:00Z"));
    expect(errorsOf({ paidAt: "2026-10-20" }).paidAt).toBe("A data não pode ser no futuro");
  });

  it("exige categoria do enum", () => {
    expect(errorsOf({ category: "" }).category).toBe("Escolha a categoria");
    expect(errorsOf({ category: "mercado" }).category).toBe("Escolha a categoria");
  });

  it("rejeita descrição só com espaços ou longa demais", () => {
    expect(errorsOf({ description: "   " }).description).toBe("Informe o que foi pago");
    expect(errorsOf({ description: "x".repeat(121) }).description).toBe("Máximo de 120 caracteres");
  });

  it("observação vazia vira null e tem limite de 1000", () => {
    expect(transactionFormSchema.parse({ ...valid, notes: "  " }).notes).toBeNull();
    expect(errorsOf({ notes: "x".repeat(1001) }).notes).toBe("Máximo de 1000 caracteres");
  });
});

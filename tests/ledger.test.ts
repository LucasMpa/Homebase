import { describe, expect, it } from "vitest";
import {
  BILL_PAYMENT_LOCKED_MESSAGE,
  dayLabel,
  editLockReason,
  filterByKind,
  groupByDay,
  parseKindParam,
} from "@/lib/ledger";

const today = "2026-10-19";

describe("dayLabel", () => {
  it("usa Hoje, Ontem ou dia da semana com data", () => {
    expect(dayLabel("2026-10-19", today)).toBe("Hoje");
    expect(dayLabel("2026-10-18", today)).toBe("Ontem");
    expect(dayLabel("2026-10-16", today)).toBe("sexta, 16/10");
    expect(dayLabel("2026-09-30", today)).toBe("quarta, 30/09");
  });
});

describe("groupByDay", () => {
  it("agrupa por dia, do mais recente para o mais antigo, mantendo a ordem dentro do dia", () => {
    const groups = groupByDay(
      [
        { id: "a", paidAt: "2026-10-19" },
        { id: "b", paidAt: "2026-10-16" },
        { id: "c", paidAt: "2026-10-19" },
        { id: "d", paidAt: "2026-10-18" },
      ],
      today,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Hoje", ["a", "c"]],
      ["Ontem", ["d"]],
      ["sexta, 16/10", ["b"]],
    ]);
  });
});

describe("filtro de tipo", () => {
  const entries = [
    { id: "conta", billId: "b1" },
    { id: "avulso", billId: null },
  ];

  it("lê o parâmetro e cai em Tudo quando inválido", () => {
    expect(parseKindParam("avulsos")).toBe("avulsos");
    expect(parseKindParam("contas")).toBe("contas");
    expect(parseKindParam(undefined)).toBe("tudo");
    expect(parseKindParam("xyz")).toBe("tudo");
    expect(parseKindParam(["contas", "avulsos"])).toBe("tudo");
  });

  it("filtra contas e avulsos", () => {
    expect(filterByKind(entries, "tudo").map((e) => e.id)).toEqual(["conta", "avulso"]);
    expect(filterByKind(entries, "avulsos").map((e) => e.id)).toEqual(["avulso"]);
    expect(filterByKind(entries, "contas").map((e) => e.id)).toEqual(["conta"]);
  });
});

describe("editLockReason", () => {
  it("recusa pagamento de conta e libera gasto avulso", () => {
    expect(editLockReason({ billId: "b1" })).toBe(BILL_PAYMENT_LOCKED_MESSAGE);
    expect(BILL_PAYMENT_LOCKED_MESSAGE).toBe("Este lançamento é o pagamento de uma conta. Altere-o pela conta.");
    expect(editLockReason({ billId: null })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { monthBounds, parseMonthParam } from "@/lib/months";

describe("parseMonthParam", () => {
  const fallback = "2026-10";
  const max = "2026-10";

  it("aceita um mês válido até o máximo", () => {
    expect(parseMonthParam("2026-09", fallback, max)).toBe("2026-09");
    expect(parseMonthParam("2026-10", fallback, max)).toBe("2026-10");
    expect(parseMonthParam("2000-01", fallback, max)).toBe("2000-01");
  });

  it.each([
    ["ausente", undefined],
    ["repetido", ["2026-09", "2026-08"]],
    ["mês 13", "2026-13"],
    ["mês 00", "2026-00"],
    ["texto", "abc"],
    ["sem zero à esquerda", "2026-9"],
    ["com dia", "2026-09-01"],
    ["antes de 2000", "1999-01"],
    ["no futuro", "2026-11"],
  ])("cai no fallback: %s", (_, param) => {
    expect(parseMonthParam(param, fallback, max)).toBe(fallback);
  });
});

describe("monthBounds", () => {
  it.each([
    ["2028-02", "2028-02-01", "2028-02-29"],
    ["2026-02", "2026-02-01", "2026-02-28"],
    ["2026-12", "2026-12-01", "2026-12-31"],
    ["2026-09", "2026-09-01", "2026-09-30"],
  ])("%s → %s a %s", (month, from, to) => {
    expect(monthBounds(month)).toEqual({ from, to });
  });
});

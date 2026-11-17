import { describe, expect, it } from "vitest";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { formatDate } from "@/lib/format";

describe("money", () => {
  it("formata BRL", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(5)).toBe("R$ 0,05");
    expect(centsToInput(123456)).toBe("1.234,56");
    expect(centsToInput(null)).toBe("");
  });

  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["R$ 1.234,5", 123450],
    ["1234", 123400],
    ["1.234", 123400],
    ["1234.56", 123456],
    ["0,99", 99],
    ["  ", null],
  ])("parseBRL(%s) = %s", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(["abc", "1,234,5", "12,345", "-5", "1.2.3,4"])("parseBRL rejeita %s", (input) => {
    expect(parseBRL(input)).toBeNaN();
  });

  it("formata data dd/mm/aaaa", () => {
    expect(formatDate("2026-02-05")).toBe("05/02/2026");
  });
});

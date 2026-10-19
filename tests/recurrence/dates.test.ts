import { describe, expect, it } from "vitest";
import { addDays, todayInSaoPaulo } from "@/lib/recurrence";

describe("addDays", () => {
  it.each([
    ["2026-01-09", 1, "2026-01-10"],
    ["2026-01-31", 1, "2026-02-01"],
    ["2026-02-28", 1, "2026-03-01"],
    ["2027-02-28", 1, "2027-03-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2028-02-29", 1, "2028-03-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2026-10-15", 30, "2026-11-14"],
    ["2026-01-01", 365, "2027-01-01"],
    ["2028-01-01", 366, "2029-01-01"],
    ["2026-01-01", 1000, "2028-09-27"],
  ])("%s + %i = %s", (date, n, expected) => {
    expect(addDays(date, n)).toBe(expected);
  });

  it.each([
    ["2027-01-01", -1, "2026-12-31"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2028-03-01", -1, "2028-02-29"],
    ["2026-01-03", -7, "2025-12-27"],
    ["2026-05-01", -1, "2026-04-30"],
    ["2029-01-01", -366, "2028-01-01"],
  ])("%s + (%i) = %s (n negativo)", (date, n, expected) => {
    expect(addDays(date, n)).toBe(expected);
  });

  it("n = 0 devolve a mesma data", () => {
    expect(addDays("2026-02-28", 0)).toBe("2026-02-28");
  });

  it("ida e volta é identidade", () => {
    expect(addDays(addDays("2028-02-29", 400), -400)).toBe("2028-02-29");
  });
});

describe("todayInSaoPaulo", () => {
  it.each([
    ["2026-03-01T02:59:59Z", "2026-02-28"],
    ["2026-03-01T03:00:00Z", "2026-03-01"],
    ["2026-12-31T23:30:00-03:00", "2026-12-31"],
    ["2027-01-01T02:00:00Z", "2026-12-31"],
    ["2027-01-01T03:00:00Z", "2027-01-01"],
    ["2026-10-16T01:00:00Z", "2026-10-15"],
    ["2026-10-16T03:00:00Z", "2026-10-16"],
    ["2026-10-15T12:00:00Z", "2026-10-15"],
    ["2028-02-29T02:00:00Z", "2028-02-28"],
    ["2028-03-01T02:59:59Z", "2028-02-29"],
    ["2028-03-01T03:00:00Z", "2028-03-01"],
  ])("%s → %s", (iso, expected) => {
    expect(todayInSaoPaulo(new Date(iso))).toBe(expected);
  });

  it.each([
    // Antigo período de horário de verão (UTC−2): hoje deve seguir UTC−3.
    ["2026-01-15T02:30:00Z", "2026-01-14"],
    ["2026-11-15T02:30:00Z", "2026-11-14"],
    ["2027-02-10T02:59:00Z", "2027-02-09"],
  ])("sem horário de verão: %s → %s", (iso, expected) => {
    expect(todayInSaoPaulo(new Date(iso))).toBe(expected);
  });

  it("devolve string no formato YYYY-MM-DD", () => {
    expect(todayInSaoPaulo(new Date("2026-01-05T15:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayInSaoPaulo(new Date("2026-01-05T15:00:00Z"))).toBe("2026-01-05");
  });
});

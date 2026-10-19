import { describe, expect, it } from "vitest";
import { occurrenceStatus, todayInSaoPaulo } from "@/lib/recurrence";

describe("occurrenceStatus", () => {
  const today = "2026-10-15";

  it("não paga e vencida → overdue", () => {
    expect(occurrenceStatus("2026-10-14", false, today)).toBe("overdue");
    expect(occurrenceStatus("2025-12-31", false, today)).toBe("overdue");
  });

  it("não paga e vence hoje → due_today", () => {
    expect(occurrenceStatus("2026-10-15", false, today)).toBe("due_today");
  });

  it("não paga e futura → upcoming", () => {
    expect(occurrenceStatus("2026-10-16", false, today)).toBe("upcoming");
    expect(occurrenceStatus("2027-01-01", false, today)).toBe("upcoming");
  });

  it("paga → paid (vencida, hoje ou futura)", () => {
    expect(occurrenceStatus("2026-09-01", true, today)).toBe("paid");
    expect(occurrenceStatus("2026-10-15", true, today)).toBe("paid");
    expect(occurrenceStatus("2026-12-01", true, today)).toBe("paid");
  });

  it("compara datas civis cruzando mês/ano corretamente", () => {
    expect(occurrenceStatus("2026-12-31", false, "2027-01-01")).toBe("overdue");
    expect(occurrenceStatus("2027-01-01", false, "2026-12-31")).toBe("upcoming");
    expect(occurrenceStatus("2026-02-28", false, "2026-03-01")).toBe("overdue");
    expect(occurrenceStatus("2026-09-30", false, "2026-10-01")).toBe("overdue");
  });
});

describe("occurrenceStatus com hoje em America/Sao_Paulo", () => {
  const due = "2026-10-16";

  it("já é dia 16 em UTC mas ainda dia 15 em SP → upcoming", () => {
    const today = todayInSaoPaulo(new Date("2026-10-16T01:00:00Z"));
    expect(today).toBe("2026-10-15");
    expect(occurrenceStatus(due, false, today)).toBe("upcoming");
  });

  it("dia 16 em SP → due_today", () => {
    const today = todayInSaoPaulo(new Date("2026-10-16T03:00:00Z"));
    expect(today).toBe("2026-10-16");
    expect(occurrenceStatus(due, false, today)).toBe("due_today");
  });

  it("dia 17 em UTC, ainda dia 16 em SP → due_today; depois overdue", () => {
    expect(occurrenceStatus(due, false, todayInSaoPaulo(new Date("2026-10-17T02:59:59Z")))).toBe(
      "due_today",
    );
    expect(occurrenceStatus(due, false, todayInSaoPaulo(new Date("2026-10-17T03:00:00Z")))).toBe(
      "overdue",
    );
  });

  it("paga continua paid independentemente do instante", () => {
    expect(occurrenceStatus(due, true, todayInSaoPaulo(new Date("2026-10-20T12:00:00Z")))).toBe(
      "paid",
    );
  });
});

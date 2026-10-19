import { describe, expect, it } from "vitest";
import { addDays, isPlainDate } from "@/lib/recurrence";
import { plainDate } from "@/lib/validation/common";

describe("anos fora de 1970–2099 (regressão)", () => {
  it("não converte anos 0–99 para 1900–1999", () => {
    expect(addDays("0024-03-05", 7)).toBe("0024-03-12");
    expect(isPlainDate("0000-02-29")).toBe(true); // ano 0 é bissexto no calendário proléptico
  });

  it("formulários aceitam só anos entre 2000 e 2100", () => {
    expect(plainDate().safeParse("0024-03-05").success).toBe(false);
    expect(plainDate().safeParse("2101-01-01").success).toBe(false);
    expect(plainDate().safeParse("2026-10-15").success).toBe(true);
  });
});

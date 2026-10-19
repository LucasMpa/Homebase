import { describe, expect, it } from "vitest";
import {
  nextOccurrences,
  occurrencesBetween,
  type BillFrequency,
  type RecurrenceRule,
} from "@/lib/recurrence";

function rule(
  frequency: BillFrequency,
  startDate: string,
  endDate: string | null = null,
  archived = false,
): RecurrenceRule {
  return { frequency, startDate, endDate, archived };
}

describe("occurrencesBetween — once", () => {
  it("ocorrência dentro do intervalo", () => {
    expect(occurrencesBetween(rule("once", "2026-05-10"), "2026-05-01", "2026-05-31")).toEqual([
      "2026-05-10",
    ]);
  });

  it("intervalo inclusivo nas duas pontas", () => {
    expect(occurrencesBetween(rule("once", "2026-05-10"), "2026-05-10", "2026-05-20")).toEqual([
      "2026-05-10",
    ]);
    expect(occurrencesBetween(rule("once", "2026-05-10"), "2026-05-01", "2026-05-10")).toEqual([
      "2026-05-10",
    ]);
  });

  it("ocorrência antes do intervalo", () => {
    expect(occurrencesBetween(rule("once", "2026-05-10"), "2026-05-11", "2026-12-31")).toEqual([]);
  });

  it("ocorrência depois do intervalo", () => {
    expect(occurrencesBetween(rule("once", "2026-05-10"), "2026-01-01", "2026-05-09")).toEqual([]);
  });

  it("nunca se repete em intervalo longo", () => {
    expect(occurrencesBetween(rule("once", "2026-05-10"), "2020-01-01", "2035-12-31")).toEqual([
      "2026-05-10",
    ]);
  });
});

describe("occurrencesBetween — weekly", () => {
  it("cruzando virada de mês e de ano", () => {
    expect(occurrencesBetween(rule("weekly", "2026-12-17"), "2026-12-01", "2027-01-20")).toEqual([
      "2026-12-17",
      "2026-12-24",
      "2026-12-31",
      "2027-01-07",
      "2027-01-14",
    ]);
  });

  it("cruzando fevereiro de ano bissexto", () => {
    expect(occurrencesBetween(rule("weekly", "2028-02-22"), "2028-02-01", "2028-03-14")).toEqual([
      "2028-02-22",
      "2028-02-29",
      "2028-03-07",
      "2028-03-14",
    ]);
  });

  it("cruzando fevereiro de ano não bissexto", () => {
    expect(occurrencesBetween(rule("weekly", "2026-02-21"), "2026-02-01", "2026-03-10")).toEqual([
      "2026-02-21",
      "2026-02-28",
      "2026-03-07",
    ]);
  });

  it("intervalo no meio da série mantém o dia da semana da âncora", () => {
    // âncora 2026-01-05; ocorrências a cada 7 dias
    expect(occurrencesBetween(rule("weekly", "2026-01-05"), "2026-03-01", "2026-03-31")).toEqual([
      "2026-03-02",
      "2026-03-09",
      "2026-03-16",
      "2026-03-23",
      "2026-03-30",
    ]);
  });

  it("intervalo menor que uma semana sem ocorrência → []", () => {
    expect(occurrencesBetween(rule("weekly", "2026-01-05"), "2026-01-06", "2026-01-11")).toEqual(
      [],
    );
  });
});

describe("occurrencesBetween — monthly", () => {
  it("ao longo de um ano inteiro", () => {
    expect(occurrencesBetween(rule("monthly", "2026-01-15"), "2026-01-01", "2026-12-31")).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
      "2026-05-15",
      "2026-06-15",
      "2026-07-15",
      "2026-08-15",
      "2026-09-15",
      "2026-10-15",
      "2026-11-15",
      "2026-12-15",
    ]);
  });

  it("âncora 31 ao longo de 2026 (volta a 31 depois de meses curtos)", () => {
    expect(occurrencesBetween(rule("monthly", "2026-01-31"), "2026-01-01", "2026-12-31")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });

  it("âncora 31 em 2028 bissexto", () => {
    expect(occurrencesBetween(rule("monthly", "2028-01-31"), "2028-01-01", "2028-04-30")).toEqual([
      "2028-01-31",
      "2028-02-29",
      "2028-03-31",
      "2028-04-30",
    ]);
  });

  it("âncora 31 cruzando ano para 2027 não bissexto", () => {
    expect(occurrencesBetween(rule("monthly", "2026-10-31"), "2026-10-01", "2027-03-31")).toEqual([
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("âncora 30 em 2026 não bissexto", () => {
    expect(occurrencesBetween(rule("monthly", "2026-01-30"), "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-30",
      "2026-02-28",
      "2026-03-30",
      "2026-04-30",
    ]);
  });

  it("âncora 30 em 2028 bissexto", () => {
    expect(occurrencesBetween(rule("monthly", "2028-01-30"), "2028-01-01", "2028-03-31")).toEqual([
      "2028-01-30",
      "2028-02-29",
      "2028-03-30",
    ]);
  });

  it("âncora 29 em 2027 não bissexto", () => {
    expect(occurrencesBetween(rule("monthly", "2027-01-29"), "2027-01-01", "2027-03-31")).toEqual([
      "2027-01-29",
      "2027-02-28",
      "2027-03-29",
    ]);
  });

  it("âncora 29 cruzando de 2027 para 2028 bissexto", () => {
    expect(occurrencesBetween(rule("monthly", "2027-12-29"), "2027-12-01", "2028-03-31")).toEqual([
      "2027-12-29",
      "2028-01-29",
      "2028-02-29",
      "2028-03-29",
    ]);
  });

  it("dia é sempre derivado da âncora, mesmo consultando a partir de mês curto", () => {
    expect(occurrencesBetween(rule("monthly", "2026-01-31"), "2026-03-01", "2026-03-31")).toEqual([
      "2026-03-31",
    ]);
    expect(occurrencesBetween(rule("monthly", "2026-01-31"), "2027-02-01", "2027-03-31")).toEqual([
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("âncora 31 ao longo de vários anos (fevereiros 2026–2028)", () => {
    const res = occurrencesBetween(rule("monthly", "2026-01-31"), "2026-01-01", "2028-12-31");
    expect(res).toHaveLength(36);
    expect(res.filter((d) => d.slice(5, 7) === "02")).toEqual([
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
    expect(res.filter((d) => d.slice(5, 7) === "03")).toEqual([
      "2026-03-31",
      "2027-03-31",
      "2028-03-31",
    ]);
  });
});

describe("occurrencesBetween — yearly", () => {
  it("ao longo de vários anos", () => {
    expect(occurrencesBetween(rule("yearly", "2026-03-10"), "2026-01-01", "2029-12-31")).toEqual([
      "2026-03-10",
      "2027-03-10",
      "2028-03-10",
      "2029-03-10",
    ]);
  });

  it("29/02 vira 28/02 em anos não bissextos e volta a 29/02", () => {
    expect(occurrencesBetween(rule("yearly", "2024-02-29"), "2024-01-01", "2028-12-31")).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });

  it("intervalo que só pega o ano bissexto seguinte", () => {
    expect(occurrencesBetween(rule("yearly", "2024-02-29"), "2028-02-01", "2028-03-31")).toEqual([
      "2028-02-29",
    ]);
  });

  it("intervalo sem a data anual → []", () => {
    expect(occurrencesBetween(rule("yearly", "2026-03-10"), "2026-03-11", "2027-03-09")).toEqual(
      [],
    );
  });
});

describe("occurrencesBetween — limites", () => {
  it("intervalo que começa antes de startDate", () => {
    expect(occurrencesBetween(rule("monthly", "2026-03-15"), "2026-01-01", "2026-05-31")).toEqual([
      "2026-03-15",
      "2026-04-15",
      "2026-05-15",
    ]);
    expect(occurrencesBetween(rule("weekly", "2026-03-15"), "2026-03-01", "2026-03-22")).toEqual([
      "2026-03-15",
      "2026-03-22",
    ]);
  });

  it("intervalo inteiramente antes de startDate → []", () => {
    expect(occurrencesBetween(rule("weekly", "2026-03-15"), "2026-01-01", "2026-03-14")).toEqual(
      [],
    );
  });

  it("intervalo que termina depois de endDate", () => {
    expect(
      occurrencesBetween(rule("monthly", "2026-01-10", "2026-04-20"), "2026-01-01", "2026-12-31"),
    ).toEqual(["2026-01-10", "2026-02-10", "2026-03-10", "2026-04-10"]);
  });

  it("intervalo inteiramente depois de endDate → []", () => {
    expect(
      occurrencesBetween(rule("weekly", "2026-01-01", "2026-02-01"), "2026-02-02", "2026-12-31"),
    ).toEqual([]);
  });

  it("endDate exatamente numa ocorrência é inclusivo", () => {
    expect(
      occurrencesBetween(rule("monthly", "2026-01-10", "2026-04-10"), "2026-01-01", "2026-12-31"),
    ).toEqual(["2026-01-10", "2026-02-10", "2026-03-10", "2026-04-10"]);
    expect(
      occurrencesBetween(rule("weekly", "2026-12-17", "2027-01-07"), "2026-12-01", "2027-12-31"),
    ).toEqual(["2026-12-17", "2026-12-24", "2026-12-31", "2027-01-07"]);
    expect(
      occurrencesBetween(rule("yearly", "2024-02-29", "2026-02-28"), "2020-01-01", "2030-12-31"),
    ).toEqual(["2024-02-29", "2025-02-28", "2026-02-28"]);
  });

  it("endDate == startDate gera exatamente uma ocorrência", () => {
    for (const f of ["weekly", "monthly", "yearly", "once"] as const) {
      expect(
        occurrencesBetween(rule(f, "2026-05-05", "2026-05-05"), "2026-01-01", "2027-12-31"),
      ).toEqual(["2026-05-05"]);
    }
  });

  it("from == to coincidindo com uma ocorrência", () => {
    expect(occurrencesBetween(rule("weekly", "2026-01-01"), "2026-01-15", "2026-01-15")).toEqual([
      "2026-01-15",
    ]);
    expect(occurrencesBetween(rule("monthly", "2026-01-31"), "2026-02-28", "2026-02-28")).toEqual([
      "2026-02-28",
    ]);
    expect(occurrencesBetween(rule("once", "2026-07-07"), "2026-07-07", "2026-07-07")).toEqual([
      "2026-07-07",
    ]);
  });

  it("from == to sem ocorrência → []", () => {
    expect(occurrencesBetween(rule("weekly", "2026-01-01"), "2026-01-16", "2026-01-16")).toEqual(
      [],
    );
  });

  it("from > to → []", () => {
    expect(occurrencesBetween(rule("weekly", "2026-01-01"), "2026-02-01", "2026-01-01")).toEqual(
      [],
    );
    expect(occurrencesBetween(rule("once", "2026-01-15"), "2026-01-20", "2026-01-10")).toEqual([]);
  });

  it("regra arquivada → [] para todas as frequências", () => {
    for (const f of ["once", "weekly", "monthly", "yearly"] as const) {
      expect(
        occurrencesBetween(rule(f, "2026-01-01", null, true), "2025-01-01", "2030-12-31"),
      ).toEqual([]);
    }
  });

  it("endDate antes de startDate → []", () => {
    expect(
      occurrencesBetween(rule("monthly", "2026-05-10", "2026-05-01"), "2026-01-01", "2026-12-31"),
    ).toEqual([]);
  });

  it("resultado em ordem crescente e sem duplicatas", () => {
    const res = occurrencesBetween(rule("monthly", "2026-01-31"), "2026-01-01", "2030-12-31");
    expect(new Set(res).size).toBe(res.length);
    expect([...res].sort()).toEqual(res);
  });
});

describe("nextOccurrences", () => {
  it("devolve exatamente count ocorrências a partir de startDate", () => {
    expect(nextOccurrences(rule("weekly", "2026-01-05"), "2026-01-05", 3)).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
    ]);
  });

  it("from no meio da série (entre ocorrências)", () => {
    expect(nextOccurrences(rule("weekly", "2026-01-05"), "2026-01-06", 3)).toEqual([
      "2026-01-12",
      "2026-01-19",
      "2026-01-26",
    ]);
  });

  it("from exatamente numa ocorrência a inclui (>= from)", () => {
    expect(nextOccurrences(rule("monthly", "2026-01-15"), "2026-06-15", 2)).toEqual([
      "2026-06-15",
      "2026-07-15",
    ]);
  });

  it("from antes de startDate começa em startDate", () => {
    expect(nextOccurrences(rule("monthly", "2026-03-31"), "2026-01-01", 3)).toEqual([
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("série que acaba antes de completar count", () => {
    expect(nextOccurrences(rule("monthly", "2026-01-15", "2026-03-15"), "2026-01-01", 5)).toEqual(
      ["2026-01-15", "2026-02-15", "2026-03-15"],
    );
    expect(nextOccurrences(rule("weekly", "2026-01-05", "2026-01-20"), "2026-01-10", 10)).toEqual(
      ["2026-01-12", "2026-01-19"],
    );
  });

  it("from depois de endDate → []", () => {
    expect(nextOccurrences(rule("weekly", "2026-01-05", "2026-01-20"), "2026-01-21", 3)).toEqual(
      [],
    );
  });

  it("once: no máximo uma ocorrência", () => {
    expect(nextOccurrences(rule("once", "2026-05-10"), "2026-01-01", 5)).toEqual(["2026-05-10"]);
    expect(nextOccurrences(rule("once", "2026-05-10"), "2026-05-10", 1)).toEqual(["2026-05-10"]);
    expect(nextOccurrences(rule("once", "2026-05-10"), "2026-05-11", 5)).toEqual([]);
  });

  it("monthly com âncora 31 a partir do meio da série", () => {
    expect(nextOccurrences(rule("monthly", "2026-01-31"), "2026-02-01", 3)).toEqual([
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("yearly 29/02", () => {
    expect(nextOccurrences(rule("yearly", "2024-02-29"), "2025-01-01", 4)).toEqual([
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });

  it("count <= 0 → []", () => {
    expect(nextOccurrences(rule("weekly", "2026-01-05"), "2026-01-05", 0)).toEqual([]);
    expect(nextOccurrences(rule("weekly", "2026-01-05"), "2026-01-05", -3)).toEqual([]);
  });

  it("regra arquivada → []", () => {
    expect(nextOccurrences(rule("monthly", "2026-01-15", null, true), "2026-01-01", 5)).toEqual(
      [],
    );
  });

  it("count grande em série sem fim devolve count itens crescentes", () => {
    const res = nextOccurrences(rule("weekly", "2026-01-05"), "2026-01-01", 60);
    expect(res).toHaveLength(60);
    expect(res[0]).toBe("2026-01-05");
    expect(new Set(res).size).toBe(60);
    expect([...res].sort()).toEqual(res);
  });

  it("é consistente com occurrencesBetween", () => {
    const r = rule("monthly", "2026-01-31");
    const next = nextOccurrences(r, "2026-01-01", 12);
    expect(next).toEqual(occurrencesBetween(r, "2026-01-01", "2026-12-31"));
  });
});

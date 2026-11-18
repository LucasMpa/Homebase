import { describe, expect, it } from "vitest";
import { billUrl, buildReminderEmail, reminderDetail, reminderSubject, sectionHeading } from "./reminder-email";
import type { Reminder, ReminderKind } from "./reminders";

function reminder(kind: ReminderKind, overrides: { name?: string; dueDate?: string; days?: number; cents?: number | null; id?: string } = {}): Reminder {
  const { name = "Luz", dueDate = "2026-11-20", days = 3, cents = 150_00, id = "b1" } = overrides;
  return {
    kind,
    dueDate,
    days,
    bill: {
      id,
      name,
      estimatedAmountCents: cents,
      rule: { frequency: "monthly", startDate: dueDate, endDate: null, archived: false },
    },
  };
}

const opts = { today: "2026-11-17", appUrl: "https://homebase.example.com/" };

describe("reminderSubject", () => {
  it("resume por urgência, com singular e plural", () => {
    expect(reminderSubject([reminder("overdue")])).toBe("Homebase: 1 conta atrasada");
    expect(reminderSubject([reminder("overdue"), reminder("overdue"), reminder("due_today")])).toBe(
      "Homebase: 2 contas atrasadas · 1 vence hoje",
    );
    expect(reminderSubject([reminder("due_in_1"), reminder("due_in_7")])).toBe("Homebase: 2 vencem nos próximos dias");
    expect(reminderSubject([reminder("due_today"), reminder("due_today"), reminder("due_in_3")])).toBe(
      "Homebase: 2 vencem hoje · 1 vence nos próximos dias",
    );
  });
});

describe("reminderDetail", () => {
  it("descreve atraso, hoje e próximos dias", () => {
    expect(reminderDetail(reminder("overdue", { dueDate: "2026-11-10", days: 7 }))).toBe(
      "Venceu em 10/11/2026 · 7 dias de atraso",
    );
    expect(reminderDetail(reminder("overdue", { dueDate: "2026-11-16", days: 1 }))).toBe(
      "Venceu em 16/11/2026 · 1 dia de atraso",
    );
    expect(reminderDetail(reminder("due_today", { dueDate: "2026-11-17", days: 0 }))).toBe("Vence hoje, 17/11/2026");
    expect(reminderDetail(reminder("due_in_3", { dueDate: "2026-11-20" }))).toBe("Vence em 20/11/2026 (sexta)");
  });
});

describe("buildReminderEmail", () => {
  const reminders = [
    reminder("overdue", { name: "Água", dueDate: "2026-11-10", days: 7, id: "agua" }),
    reminder("due_in_3", { name: "Luz", id: "luz" }),
    reminder("due_in_7", { name: "Internet", dueDate: "2026-11-24", days: 7, cents: null, id: "net" }),
  ];
  const email = buildReminderEmail(reminders, opts);

  it("assunto, data e seções com a quantidade de contas", () => {
    expect(email.subject).toBe("Homebase: 1 conta atrasada · 2 vencem nos próximos dias");
    expect(email.html).toContain("terça, 17/11/2026");
    expect(email.html).toContain(">Atrasadas - 1 conta<");
    // 3 e 7 dias ficam juntos em "Vence em breve".
    expect(email.html).toContain(">Vence em breve - 2 contas<");
    expect(email.html).not.toContain("Vence em 3 dias");
    expect(email.html).not.toContain(">Vence hoje");
  });

  it("seções em ordem de urgência; em breve ordenado por data", () => {
    const all = buildReminderEmail(
      [
        reminder("due_in_7", { name: "Internet", dueDate: "2026-11-24", id: "net" }),
        reminder("due_in_1", { name: "Água", dueDate: "2026-11-18", days: 1, id: "agua" }),
        reminder("due_in_3", { name: "Luz", dueDate: "2026-11-20", id: "luz" }),
        reminder("due_today", { name: "Gás", dueDate: "2026-11-17", days: 0, id: "gas" }),
        reminder("overdue", { name: "Aluguel", dueDate: "2026-11-10", days: 7, id: "aluguel" }),
      ],
      opts,
    ).html;
    const at = (t: string) => all.indexOf(t);
    const headings = [
      ">Atrasadas - 1 conta<",
      ">Vence hoje - 1 conta<",
      ">Vence amanhã - 1 conta<",
      ">Vence em breve - 2 contas<",
    ].map(at);
    expect(headings.every((i) => i > 0)).toBe(true);
    expect([...headings].sort((a, b) => a - b)).toEqual(headings);
    expect(at(">Luz<")).toBeLessThan(at(">Internet<"));
    expect(at(">Internet<")).toBeGreaterThan(headings[3]);
  });

  it("sectionHeading no singular e no plural", () => {
    expect(sectionHeading("Vence em breve", 1)).toBe("Vence em breve - 1 conta");
    expect(sectionHeading("Vence em breve", 3)).toBe("Vence em breve - 3 contas");
  });

  it("valores, valor ausente e links para cada conta", () => {
    expect(email.html).toContain("R$ 150,00");
    expect(email.html).toContain("valor não informado");
    expect(email.html).toContain('href="https://homebase.example.com/bills/agua"');
    expect(email.html).toContain('href="https://homebase.example.com/bills"');
    expect(email.html).toContain('src="https://homebase.example.com/apple-icon.png"');
  });

  it("atrasada em vermelho (cor de atraso do app)", () => {
    expect(email.html).toMatch(/color:#ff8e98;">Atrasadas - 1 conta</);
  });

  it("escapa o nome da conta no HTML", () => {
    const html = buildReminderEmail([reminder("due_today", { name: `<b>"Luz" & gás</b>` })], opts).html;
    expect(html).toContain("&lt;b&gt;&quot;Luz&quot; &amp; gás&lt;/b&gt;");
    expect(html).not.toContain("<b>\"Luz\"");
  });

  it("texto puro com as mesmas informações", () => {
    expect(email.text).toContain("Atrasadas - 1 conta");
    expect(email.text).toContain("Vence em breve - 2 contas");
    expect(email.text).toContain("- Água: R$ 150,00. Venceu em 10/11/2026 · 7 dias de atraso.");
    expect(email.text).toContain("https://homebase.example.com/bills/luz");
    expect(email.text).toContain("- Internet: valor não informado.");
  });

  it("billUrl codifica o id e ignora barra final", () => {
    expect(billUrl("http://localhost:3000/", "a b")).toBe("http://localhost:3000/bills/a%20b");
  });
});

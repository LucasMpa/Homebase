import { describe, expect, it } from "vitest";
import { billUrl, buildReminderEmail, reminderDetail, reminderSubject } from "./reminder-email";
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

  it("assunto, data e grupos na ordem de urgência", () => {
    expect(email.subject).toBe("Homebase: 1 conta atrasada · 2 vencem nos próximos dias");
    expect(email.html).toContain("terça, 17/11/2026");
    const order = ["Atrasada", "Vence em 3 dias", "Vence em 7 dias"].map((t) => email.html.indexOf(`>${t}<`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("valores, valor ausente e links para cada conta", () => {
    expect(email.html).toContain("R$ 150,00");
    expect(email.html).toContain("valor não informado");
    expect(email.html).toContain('href="https://homebase.example.com/bills/agua"');
    expect(email.html).toContain('href="https://homebase.example.com/bills"');
    expect(email.html).toContain('src="https://homebase.example.com/apple-icon.png"');
  });

  it("atrasada em vermelho (cor de atraso do app)", () => {
    expect(email.html).toMatch(/color:#ff8e98;">Atrasada</);
  });

  it("escapa o nome da conta no HTML", () => {
    const html = buildReminderEmail([reminder("due_today", { name: `<b>"Luz" & gás</b>` })], opts).html;
    expect(html).toContain("&lt;b&gt;&quot;Luz&quot; &amp; gás&lt;/b&gt;");
    expect(html).not.toContain("<b>\"Luz\"");
  });

  it("texto puro com as mesmas informações", () => {
    expect(email.text).toContain("ATRASADA");
    expect(email.text).toContain("- Água: R$ 150,00. Venceu em 10/11/2026 · 7 dias de atraso.");
    expect(email.text).toContain("https://homebase.example.com/bills/luz");
    expect(email.text).toContain("- Internet: valor não informado.");
  });

  it("billUrl codifica o id e ignora barra final", () => {
    expect(billUrl("http://localhost:3000/", "a b")).toBe("http://localhost:3000/bills/a%20b");
  });
});

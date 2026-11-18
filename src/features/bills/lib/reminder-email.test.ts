import { describe, expect, it } from "vitest";
import {
  billUrl,
  buildReminderEmail,
  reminderDetail,
  reminderPreview,
  reminderSubject,
  reminderTotals,
  sectionHeading,
} from "./reminder-email";
import type { Reminder, ReminderKind } from "./reminders";

function reminder(
  kind: ReminderKind,
  overrides: { name?: string; dueDate?: string; days?: number; cents?: number | null; id?: string } = {},
): Reminder {
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
  it("é fixo, só com o dia e o mês", () => {
    expect(reminderSubject("2026-11-17")).toBe("Resumo das contas no Homebase - 17/11");
    expect(reminderSubject("2027-01-05")).toBe("Resumo das contas no Homebase - 05/01");
  });
});

describe("reminderTotals", () => {
  it("soma só as contas com valor estimado", () => {
    expect(
      reminderTotals([reminder("overdue", { cents: 2_300_00 }), reminder("due_today", { cents: 98_40 }), reminder("due_in_7", { cents: null })]),
    ).toEqual({ totalCents: 2_398_40, count: 3, withAmount: 2 });
  });
});

describe("reminderPreview", () => {
  it("total informado e contagem por urgência", () => {
    expect(reminderPreview([reminder("overdue")])).toBe("Total a pagar informado: R$ 150,00 · 1 conta atrasada");
    expect(reminderPreview([reminder("overdue"), reminder("overdue"), reminder("due_today")])).toBe(
      "Total a pagar informado: R$ 450,00 · 2 contas atrasadas · 1 vence hoje",
    );
    expect(reminderPreview([reminder("due_today"), reminder("due_today"), reminder("due_in_3")])).toBe(
      "Total a pagar informado: R$ 450,00 · 2 vencem hoje · 1 vence nos próximos dias",
    );
  });

  it("sem nenhum valor informado, só a contagem", () => {
    expect(reminderPreview([reminder("due_in_1", { cents: null }), reminder("due_in_7", { cents: null })])).toBe(
      "2 vencem nos próximos dias",
    );
  });
});

describe("reminderDetail", () => {
  it("descreve atraso, hoje e próximos dias", () => {
    expect(reminderDetail(reminder("overdue", { dueDate: "2026-11-10", days: 7 }))).toBe(
      "Venceu em 10/11/2026 • 7 dias de atraso",
    );
    expect(reminderDetail(reminder("overdue", { dueDate: "2026-11-16", days: 1 }))).toBe(
      "Venceu em 16/11/2026 • 1 dia de atraso",
    );
    expect(reminderDetail(reminder("due_today", { dueDate: "2026-11-17", days: 0 }))).toBe("Vence hoje, 17/11/2026");
    expect(reminderDetail(reminder("due_in_3", { dueDate: "2026-11-20" }))).toBe("Vence em 20/11/2026 (sexta)");
  });
});

describe("sectionHeading", () => {
  it("título, travessão e quantidade no singular e no plural", () => {
    expect(sectionHeading("Vence em breve", 1)).toBe("Vence em breve – 1 conta");
    expect(sectionHeading("Vence em breve", 3)).toBe("Vence em breve – 3 contas");
  });
});

describe("buildReminderEmail", () => {
  const reminders = [
    reminder("overdue", { name: "Água", dueDate: "2026-11-10", days: 7, id: "agua" }),
    reminder("due_in_3", { name: "Luz", id: "luz" }),
    reminder("due_in_7", { name: "Internet", dueDate: "2026-11-24", days: 7, cents: null, id: "net" }),
  ];
  const email = buildReminderEmail(reminders, opts);

  it("assunto, prévia, data e card de total", () => {
    expect(email.subject).toBe("Resumo das contas no Homebase - 17/11");
    expect(email.html).toContain(
      ">Total a pagar informado: R$ 300,00 · 1 conta atrasada · 2 vencem nos próximos dias&#847;&zwnj;&nbsp;",
    );
    expect(email.html).toContain("terça, 17/11/2026");
    expect(email.html).toContain(">R$ 300,00</div>");
    expect(email.html).toContain(">3 contas no resumo</div>");
    expect(email.html).not.toContain("com valor definido");
  });

  it("seções com quantidade; 3 e 7 dias juntos em \"Vence em breve\"", () => {
    expect(email.html).toContain("Atrasadas – 1 conta</div>");
    expect(email.html).toContain(">Vence em breve – 2 contas</div>");
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
      "Atrasadas – 1 conta<",
      ">Vence hoje – 1 conta<",
      ">Vence amanhã – 1 conta<",
      ">Vence em breve – 2 contas<",
    ].map(at);
    expect(headings.every((i) => i > 0)).toBe(true);
    expect([...headings].sort((a, b) => a - b)).toEqual(headings);
    expect(at(">Luz<")).toBeLessThan(at(">Internet<"));
    expect(at(">Internet<")).toBeGreaterThan(headings[3]);
  });

  it("atrasadas: título vermelho com marcador e card com filete vermelho", () => {
    expect(email.html).toMatch(/color:#ff8e98;margin-bottom:10px;"><span [^>]*background-color:#ff8e98;[^>]*><\/span>Atrasadas – 1 conta/);
    expect(email.html).toContain("border-left:3px solid #b51a2b;");
    expect(email.html).toContain(">Venceu em 10/11/2026 • 7 dias de atraso<");
  });

  it("valores, valor ausente em itálico e links para cada conta e para o painel", () => {
    expect(email.html).toContain(">R$ 150,00</span>");
    expect(email.html).toMatch(/font-style:italic;[^>]*>valor não informado</);
    expect(email.html).toContain('href="https://homebase.example.com/bills/agua"');
    expect(email.html).toContain('href="https://homebase.example.com/bills"');
    expect(email.html).toContain("Gerenciar todas as contas no painel &rarr;");
  });

  it("cantos arredondados: tabelas sem border-collapse: collapse e raio também no celular", () => {
    expect(email.html).not.toMatch(/border-collapse:\s*collapse/);
    expect(email.html).toContain("table { border-collapse: separate !important; border-spacing: 0; }");
    expect(email.html).toMatch(/max-width:600px;[^"]*border-radius:20px;/);
    expect(email.html).toContain("border-radius:0 0 20px 20px;");
    expect(email.html).not.toContain("border-radius: 0px !important");
  });

  it("celular: colunas empilhadas não passam da largura do card", () => {
    const mobile = email.html.slice(email.html.indexOf("@media only screen"));
    expect(mobile).toMatch(/\.stack-column \{[^}]*box-sizing: border-box !important;/);
    expect(mobile).toMatch(/\.stack-column-right \{[^}]*box-sizing: border-box !important;/);
  });

  it("celular: valor à esquerda e \"Ver conta\" à direita (space-between); desktop: juntos à direita", () => {
    expect(email.html).toMatch(
      /<td align="left"[^>]*><span class="bill-amount"[^>]*>R\$ 150,00<\/span><\/td>\s*<td align="right"[^>]*>\s*<a [^>]*>Ver conta<\/a>/,
    );
    // Desktop: a coluna do valor tem a largura mínima e o valor não quebra.
    expect(email.html).toContain('<td width="1%" style="width:1%;');
    expect(email.html).toMatch(/class="bill-amount" style="[^"]*white-space:nowrap;/);
    // Celular: a coluna ocupa a linha toda, alinhada à esquerda, e o valor pode quebrar.
    const mobile = email.html.slice(email.html.indexOf("@media only screen"));
    expect(mobile).toMatch(/\.stack-column-right \{[^}]*width: 100% !important;[^}]*text-align: left !important;/);
    expect(mobile).toContain(".bill-amount { white-space: normal !important; }");
  });

  it("celular: card do total centralizado (rótulo, valor e pílula afastada do valor)", () => {
    expect(email.html).toContain('class="stack-column total-amount"');
    expect(email.html).toContain('class="stack-column-right total-badge"');
    const mobile = email.html.slice(email.html.indexOf("@media only screen"));
    expect(mobile).toContain(".total-amount { text-align: center !important; }");
    expect(mobile).toContain(".total-badge { text-align: center !important; padding-top: 14px !important; }");
    // Precisam vir depois de .stack-column(-right), que alinham à esquerda, para prevalecer.
    expect(mobile.indexOf(".total-amount {")).toBeGreaterThan(mobile.indexOf(".stack-column-right {"));
    expect(mobile.indexOf(".total-badge {")).toBeGreaterThan(mobile.indexOf(".stack-column-right {"));
  });

  it("sem links para páginas que não existem", () => {
    for (const path of ["/dashboard", "/notificacoes", "/preferencias", "/unsubscribe"]) {
      expect(email.html).not.toContain(path);
    }
  });

  it("escapa o nome da conta no HTML", () => {
    const html = buildReminderEmail([reminder("due_today", { name: `<b>"Luz" & gás</b>` })], opts).html;
    expect(html).toContain("&lt;b&gt;&quot;Luz&quot; &amp; gás&lt;/b&gt;");
    expect(html).not.toContain('<b>"Luz"');
  });

  it("texto puro com as mesmas informações", () => {
    expect(email.text).toContain("Total a pagar informado: R$ 300,00 (3 contas no resumo)");
    expect(email.text).toContain("Atrasadas – 1 conta");
    expect(email.text).toContain("Vence em breve – 2 contas");
    expect(email.text).toContain("- Água: R$ 150,00. Venceu em 10/11/2026 • 7 dias de atraso.");
    expect(email.text).toContain("https://homebase.example.com/bills/luz");
    expect(email.text).toContain("- Internet: valor não informado.");
  });

  it("billUrl codifica o id e ignora barra final", () => {
    expect(billUrl("http://localhost:3000/", "a b")).toBe("http://localhost:3000/bills/a%20b");
  });
});

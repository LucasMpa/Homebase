import { describe, expect, it, vi } from "vitest";
import type { ReminderBill, SentReminder } from "@/features/bills/lib/reminders";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ SUPABASE_URL: "http://supabase.test", SUPABASE_PUBLISHABLE_KEY: "chave-publica" }));
const { parseReminderData, ReminderJobUnauthorizedError, runReminderJob } = await import("./reminder-job");
type Deps = import("./reminder-job").ReminderJobDeps;
type Data = import("./reminder-job").ReminderData;

const bill = (id: string, startDate: string, cents: number | null = 100_00): ReminderBill => ({
  id,
  name: id,
  estimatedAmountCents: cents,
  rule: { frequency: "once", startDate, endDate: null, archived: false },
});

function deps(data: Data | null) {
  const store: SentReminder[] = [...(data?.sent ?? [])];
  const d = {
    getData: vi.fn(async () => (data ? { ...data, sent: [...store] } : null)),
    record: vi.fn(async (items: SentReminder[]) => {
      store.push(...items);
      return items.length;
    }),
    send: vi.fn(async () => ({ provider: "mailpit" as const, id: "m1" })),
  } satisfies Deps;
  return d;
}

const today = "2026-11-17";
const opts = { today, appUrl: "http://localhost:3000" };
const data = (bills: ReminderBill[]): Data => ({ email: "eu@example.com", bills, payments: [], sent: [] });

describe("runReminderJob", () => {
  it("busca a janela certa: 60 dias para trás e 7 para frente", async () => {
    const d = deps(data([]));
    await runReminderJob(d, opts);
    expect(d.getData).toHaveBeenCalledWith("2026-09-18", "2026-11-24");
  });

  it("sem avisos: não envia nem registra", async () => {
    const d = deps(data([bill("luz", "2026-11-30")]));
    expect(await runReminderJob(d, opts)).toEqual({ status: "nothing", today });
    expect(d.send).not.toHaveBeenCalled();
    expect(d.record).not.toHaveBeenCalled();
  });

  it("dry-run: devolve assunto, avisos e HTML, sem enviar nem registrar", async () => {
    const d = deps(data([bill("luz", "2026-11-20"), bill("agua", "2026-11-10")]));
    const result = await runReminderJob(d, { ...opts, dryRun: true });
    expect(result).toMatchObject({
      status: "dry-run",
      to: "eu@example.com",
      subject: "Resumo das contas no Homebase - 17/11",
      reminders: [
        { bill: "agua", dueDate: "2026-11-10", kind: "overdue", days: 7 },
        { bill: "luz", dueDate: "2026-11-20", kind: "due_in_3", days: 3 },
      ],
    });
    expect(result.status === "dry-run" && result.html).toContain("Resumo das contas");
    expect(d.send).not.toHaveBeenCalled();
    expect(d.record).not.toHaveBeenCalled();
  });

  it("envio: manda para o e-mail permitido e depois registra os avisos", async () => {
    const d = deps(data([bill("luz", "2026-11-20")]));
    const result = await runReminderJob(d, opts);
    expect(result).toMatchObject({ status: "sent", recorded: 1, sent: { provider: "mailpit", id: "m1" } });
    expect(d.send).toHaveBeenCalledWith(expect.objectContaining({ to: "eu@example.com", subject: expect.any(String) }));
    expect(d.record).toHaveBeenCalledWith([{ billId: "luz", dueDate: "2026-11-20", kind: "due_in_3", sentOn: today }]);
    expect(d.send.mock.invocationCallOrder[0]).toBeLessThan(d.record.mock.invocationCallOrder[0]);
  });

  it("rodar de novo no mesmo dia não reenvia", async () => {
    const d = deps(data([bill("luz", "2026-11-20")]));
    await runReminderJob(d, opts);
    expect(await runReminderJob(d, opts)).toEqual({ status: "nothing", today });
    expect(d.send).toHaveBeenCalledTimes(1);
  });

  it("falha no envio: não registra (o aviso sai na próxima execução)", async () => {
    const d = deps(data([bill("luz", "2026-11-20")]));
    d.send.mockRejectedValueOnce(new Error("Resend fora do ar"));
    await expect(runReminderJob(d, opts)).rejects.toThrow("Resend fora do ar");
    expect(d.record).not.toHaveBeenCalled();
  });

  it("segredo recusado pelo banco: erro específico", async () => {
    await expect(runReminderJob(deps(null), opts)).rejects.toBeInstanceOf(ReminderJobUnauthorizedError);
  });
});

describe("parseReminderData", () => {
  it("converte o JSON da função do banco", () => {
    const parsed = parseReminderData({
      email: "eu@example.com",
      bills: [
        { id: "b1", name: "Luz", frequency: "monthly", startDate: "2026-01-10", endDate: null, estimatedAmountCents: 15000 },
      ],
      payments: [{ billId: "b1", dueDate: "2026-10-10", paidAt: "2026-10-09", amountCents: 15000 }],
      sent: [{ billId: "b1", dueDate: "2026-11-10", kind: "overdue", sentOn: "2026-11-11" }],
    });
    expect(parsed.bills[0]).toEqual({
      id: "b1",
      name: "Luz",
      estimatedAmountCents: 15000,
      rule: { frequency: "monthly", startDate: "2026-01-10", endDate: null, archived: false },
    });
    expect(parsed.sent[0].kind).toBe("overdue");
  });

  it("recusa dados malformados", () => {
    expect(() => parseReminderData({ email: "x@y.z", bills: [{ id: 1 }], payments: [], sent: [] })).toThrow();
    expect(() =>
      parseReminderData({ email: "x@y.z", bills: [], payments: [], sent: [{ billId: "b", dueDate: "2026-11-10", kind: "xyz", sentOn: "2026-11-11" }] }),
    ).toThrow();
  });
});

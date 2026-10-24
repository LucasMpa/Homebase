import { beforeEach, describe, expect, it, vi } from "vitest";
import { BILL_PAYMENT_LOCKED_MESSAGE } from "@/lib/ledger";

/**
 * Chama as actions de verdade com um Supabase falso: confere que pagamento de
 * conta é recusado antes de qualquer escrita e que avulsos passam com o filtro
 * `.is("bill_id", null)`.
 */

const db = vi.hoisted(() => ({
  /** Linha devolvida pela leitura do lançamento (null = não existe). */
  row: null as { bill_id: string | null } | null,
  calls: [] as string[],
}));

vi.mock("@/lib/auth", () => {
  type Query = {
    eq: (column: string, value: unknown) => Query;
    is: (column: string, value: unknown) => Query;
    select: () => Query;
    maybeSingle: () => Promise<unknown>;
  };
  // Registra filtros de escrita com coluna e valor; a leitura do bill_id não entra em `calls`.
  const query = (op: string): Query => {
    const record = (method: string, column: string, value: unknown) => {
      if (op !== "read") db.calls.push(`${op}.${method}(${column}, ${JSON.stringify(value)})`);
    };
    const q: Query = {
      eq: (column, value) => {
        record("eq", column, value);
        return q;
      },
      is: (column, value) => {
        record("is", column, value);
        return q;
      },
      select: () => q,
      maybeSingle: async () =>
        op === "read" ? { data: db.row, error: null } : { data: { paid_at: "2026-10-19" }, error: null },
    };
    return q;
  };
  const supabase = {
    from: () => ({
      select: () => query("read"),
      update: () => {
        db.calls.push("update");
        return query("update");
      },
      delete: () => {
        db.calls.push("delete");
        return query("delete");
      },
    }),
  };
  return { requireUser: async () => ({ user: { id: "u1" }, supabase }) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { deleteTransaction, updateTransaction } = await import("@/server/transaction-actions");

const ID = "7f1c2a3e-5b6d-4e8f-9a0b-1c2d3e4f5a6b";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const validForm = () =>
  form({ description: "Ingresso do show", amount: "180", paidAt: "2026-01-10", category: "lazer", notes: "" });

beforeEach(() => {
  db.row = null;
  db.calls = [];
});

describe("pagamento de conta não muda por Lançamentos", () => {
  beforeEach(() => {
    db.row = { bill_id: "b1" };
  });

  it("updateTransaction recusa sem escrever", async () => {
    const state = await updateTransaction(ID, {}, validForm());
    expect(state.message).toBe(BILL_PAYMENT_LOCKED_MESSAGE);
    expect(db.calls).toEqual([]);
  });

  it("deleteTransaction recusa sem escrever", async () => {
    const result = await deleteTransaction(ID);
    expect(result).toEqual({ ok: false, message: BILL_PAYMENT_LOCKED_MESSAGE });
    expect(db.calls).toEqual([]);
  });
});

describe("gasto avulso", () => {
  beforeEach(() => {
    db.row = { bill_id: null };
  });

  it("updateTransaction grava só avulsos e volta para o mês do gasto", async () => {
    await expect(updateTransaction(ID, {}, validForm())).rejects.toThrow(
      "REDIRECT /transactions?mes=2026-10&aviso=atualizado",
    );
    // Sem o eq("id"), o update atingiria todos os avulsos.
    expect(db.calls).toEqual(["update", `update.eq(id, "${ID}")`, "update.is(bill_id, null)"]);
  });

  it("deleteTransaction apaga só avulsos e volta para o mês do gasto", async () => {
    await expect(deleteTransaction(ID)).rejects.toThrow("REDIRECT /transactions?mes=2026-10&aviso=excluido");
    expect(db.calls).toEqual(["delete", `delete.eq(id, "${ID}")`, "delete.is(bill_id, null)"]);
  });
});

it("id que não é UUID é recusado antes de ler o banco", async () => {
  expect(await deleteTransaction("abc")).toEqual({ ok: false, message: "Gasto inválido." });
  expect((await updateTransaction("abc", {}, validForm())).message).toBe("Gasto inválido.");
  expect(db.calls).toEqual([]);
});

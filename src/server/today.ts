import "server-only";
import { connection } from "next/server";
import { todayInSaoPaulo } from "@/lib/dates";

/** "Hoje" em São Paulo, sempre calculado no momento da requisição (nunca no build). */
export async function getToday() {
  await connection();
  return todayInSaoPaulo();
}

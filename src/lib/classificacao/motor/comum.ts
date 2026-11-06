/* Motor da classificação: auxiliares comuns (API pública em ../motor.ts). */

import type { CandidatoDoMotor } from "../tipos-do-motor.ts";

export function exigir<T>(valor: T | undefined): T {
  if (valor === undefined)
    throw new Error("Dados internos da classificação inconsistentes.");
  return valor;
}

export const texto = (valor: unknown) => String(valor ?? "").trim();
export const comparaNome = (a: CandidatoDoMotor, b: CandidatoDoMotor) =>
  a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) ||
  (a.analiseId < b.analiseId ? -1 : a.analiseId > b.analiseId ? 1 : 0);

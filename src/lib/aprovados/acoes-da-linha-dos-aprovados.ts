/*
  As ações de uma linha da Lista de aprovados (revisão de 17/11/2026): no
  lugar da fileira de ícones pequenos (anexos, lápis, carta, martelo,
  remover), uma ação principal com nome ("Mudar status" para quem pode;
  "Abrir" para os demais) e o resto no "⋯ Mais ações de <nome>". Sem DOM: a
  tela liga cada `id` à sua ação. As regras de permissão são as de sempre
  (lista-aprovados-rules.ts e access-roles.ts).
*/
import { canChangeCandidateStatus } from "../acessos/access-roles.ts";
import {
  canAlterarCandidatoSubJudice,
  canEditCandidateStatus,
  canEditSubJudice,
  statusTravado,
} from "./lista-aprovados-rules.ts";
import type { CandidatoDasRegrasDeAprovados } from "./tipos-das-regras-de-aprovados.ts";

export type IdDaAcaoDoAprovado =
  | "status"
  | "candidato"
  | "anexos"
  | "carta"
  | "classificacao"
  | "alteracao-judicial"
  | "remove-subjudice";

export interface AcaoDoAprovado {
  id: IdDaAcaoDoAprovado;
  rotulo: string;
  desabilitado?: boolean;
}

export interface AcoesDaLinhaDoAprovado {
  principal: AcaoDoAprovado;
  outras: AcaoDoAprovado[];
}

/** Por que o status não muda na linha ("" quando muda ou quando não é de quem vê). */
export function statusBloqueado(
  perfil: unknown,
  candidato: CandidatoDasRegrasDeAprovados,
): string {
  if (!canChangeCandidateStatus(perfil)) return "";
  if (!candidato.lista_ativa) return "lista inativa";
  if (statusTravado(perfil, candidato))
    return "status já definido: só o admin altera";
  return "";
}

/**
 * A principal e as do menu. `anexos`: quantos anexos o candidato tem
 * (sem anexo, o item não aparece).
 */
export function acoesDaLinhaDoAprovado(
  perfil: unknown,
  candidato: CandidatoDasRegrasDeAprovados,
  anexos = 0,
): AcoesDaLinhaDoAprovado {
  const mudaStatus = canEditCandidateStatus(perfil, candidato);
  const principal: AcaoDoAprovado = mudaStatus
    ? { id: "status", rotulo: "Mudar status" }
    : { id: "candidato", rotulo: "Abrir" };
  const outras: AcaoDoAprovado[] = [];
  if (mudaStatus) outras.push({ id: "candidato", rotulo: "Ver detalhes" });
  const bloqueio = statusBloqueado(perfil, candidato);
  if (bloqueio)
    outras.push({
      id: "status",
      rotulo: `Mudar status (${bloqueio})`,
      desabilitado: true,
    });
  if (anexos > 0)
    outras.push({ id: "anexos", rotulo: `Ver anexos (${anexos})` });
  if (candidato.lista_ativa && canChangeCandidateStatus(perfil))
    outras.push({ id: "carta", rotulo: "Carta de convocação" });
  if (String(candidato.edital_id ?? "").trim())
    outras.push({ id: "classificacao", rotulo: "Ver na Classificação" });
  if (canAlterarCandidatoSubJudice(perfil, candidato))
    outras.push({
      id: "alteracao-judicial",
      rotulo: "Alterar nota ou modalidade (decisão judicial)",
    });
  if (canEditSubJudice(perfil, candidato))
    outras.push({ id: "remove-subjudice", rotulo: "Remover sub judice" });
  return { principal, outras };
}

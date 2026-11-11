import type { CandidatoDasRegrasDeAprovados } from "./tipos-das-regras-de-aprovados.ts";
import {
  canChangeCandidateStatus,
  canUnlockCandidateStatus,
} from "./access-roles.ts";
import { formatNumberBR } from "./formatters";

/*
  Status em lote na aba Aprovados (pedido de 11/11/2026; RPC
  alterar_status_candidatos_aprovados, migration 20261111180000).

  Só os status que não pedem nada de cada pessoa: Convocado (uma data para
  todos), Desistente, Documentação Rejeitada e, para o admin de Aprovados,
  "sem status". Contratado e Migração pedem a matrícula de cada um e ficam na
  mudança de um por vez.

  As regras são as da mudança de um candidato (lista-aprovados-rules.ts) e o
  banco as repete, um a um: a tela mostra antes quem fica de fora e por quê; o
  banco devolve os que recusou em "ignorados".
*/

export const STATUS_EM_LOTE = Object.freeze([
  "Convocado",
  "Desistente",
  "Documentação Rejeitada",
] as const);

/** O valor do "Sem status" na escolha (o banco recebe null). */
export const SEM_STATUS_EM_LOTE = "";

/** O mesmo teto do banco (e de marcar_candidatos_convocados). */
export const LIMITE_DO_LOTE = 500;

const text = (value: unknown) => String(value ?? "").trim();

export interface ForaDoLote {
  candidato_id: string;
  nome: string;
  motivo: string;
}

export interface PlanoDoLote<C> {
  alterar: C[];
  fora: ForaDoLote[];
}

/** Os status que esta pessoa pode escolher no lote (sem status, só o admin). */
export function statusDoLotePara(perfil: unknown): string[] {
  if (!canChangeCandidateStatus(perfil)) return [];
  return [
    ...STATUS_EM_LOTE,
    ...(canUnlockCandidateStatus(perfil) ? [SEM_STATUS_EM_LOTE] : []),
  ];
}

export const rotuloDoStatusDoLote = (status: string) =>
  text(status) || "Sem status";

/*
  Quem muda e quem fica de fora (com o motivo), na ordem da seleção. O mesmo
  que o banco decide, para a confirmação dizer o número certo.
*/
export function planejarStatusEmLote<C extends CandidatoDasRegrasDeAprovados>(
  perfil: unknown,
  candidatos: readonly C[],
  status: string,
): PlanoDoLote<C> {
  const novo = text(status);
  const admin = canUnlockCandidateStatus(perfil);
  const pode = canChangeCandidateStatus(perfil);
  const alterar: C[] = [];
  const fora: ForaDoLote[] = [];
  for (const candidato of candidatos) {
    const atual = text(candidato.status);
    const motivo = !pode
      ? "Sem permissão para alterar status"
      : !candidato.lista_ativa
        ? "Lista inativa ou substituída"
        : atual === novo
          ? atual
            ? `Já está como ${atual}`
            : "Já está sem status"
          : !novo && !admin
            ? "Só o admin deixa sem status"
            : atual && atual !== "Convocado" && !admin
              ? `Status já definido (${atual}): só o admin muda`
              : "";
    if (motivo)
      fora.push({
        candidato_id: text(candidato.candidato_id),
        nome: text(candidato.nome),
        motivo,
      });
    else alterar.push(candidato);
  }
  return { alterar, fora };
}

/** "12 sem status · 3 Convocado": como estão hoje os que vão mudar. */
export function resumoDoStatusAtual(
  candidatos: readonly CandidatoDasRegrasDeAprovados[],
): string {
  const contagem = new Map<string, number>();
  for (const c of candidatos) {
    const chave = text(c.status) || "sem status";
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([status, n]) => `${formatNumberBR(n)} ${status}`)
    .join(" · ");
}

/** Os motivos de quem fica de fora, agrupados: "Já está como Desistente (4)". */
export function motivosDeFora(fora: readonly ForaDoLote[]): string[] {
  const contagem = new Map<string, number>();
  for (const f of fora)
    contagem.set(f.motivo, (contagem.get(f.motivo) || 0) + 1);
  return [...contagem.entries()].map(
    ([motivo, n]) => `${motivo} (${formatNumberBR(n)})`,
  );
}

/** O texto do botão de confirmar: "Mudar 37 candidatos para Desistente". */
export function textoDaConfirmacaoDoLote(quantos: number, status: string) {
  const pessoas =
    quantos === 1 ? "1 candidato" : `${formatNumberBR(quantos)} candidatos`;
  return text(status)
    ? `Mudar ${pessoas} para ${status}`
    : `Deixar ${pessoas} sem status`;
}

/** Os editais da seleção, para a confirmação: "Edital 93/2026" ou "3 editais". */
export function editaisDoLote(
  candidatos: readonly CandidatoDasRegrasDeAprovados[],
): string {
  const editais = [
    ...new Set(candidatos.map((c) => text(c.edital)).filter(Boolean)),
  ];
  if (!editais.length) return "";
  if (editais.length === 1) return `Edital ${editais[0]}`;
  return `${formatNumberBR(editais.length)} editais`;
}

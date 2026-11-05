/*
  A aba "Pessoas" da Triagem: achar alguém no edital todo, sem abrir vaga por
  vaga. Regras puras (sem DOM): o filtro (busca por código ou nome, vaga e
  situação), quantos filtros estão em uso, o que ele pede ao banco
  (listar_pre_classificacao, 50 por vez: um recorte por grupo) e as ações
  de cada pessoa (o botão principal e o "⋯").

  O banco busca por código ou nome (FC_TEXTO_DE_BUSCA). CPF não está nas
  linhas da triagem: buscar por ele pediria o dado novo (ver o PR).
*/
import type {
  GrupoDaPre,
  RecorteDaPre,
} from "./paginas-da-pre-classificacao.ts";
import {
  podeIncluirPorDecisao,
  seloDaDecisao,
} from "./tela-da-pre-classificacao.ts";

/** "TODAS": classificados e eliminados, em duas listas. */
export type SituacaoDasPessoas = "TODAS" | GrupoDaPre;

export interface FiltroDasPessoas {
  busca: string;
  vaga: string;
  situacao: SituacaoDasPessoas;
}

export const FILTRO_DAS_PESSOAS_INICIAL: Readonly<FiltroDasPessoas> =
  Object.freeze({ busca: "", vaga: "", situacao: "TODAS" });

export const SITUACOES_DAS_PESSOAS: ReadonlyArray<{
  valor: SituacaoDasPessoas;
  rotulo: string;
}> = Object.freeze([
  { valor: "TODAS", rotulo: "Todas" },
  { valor: "CLASSIFICADOS", rotulo: "Classificados (no lote e fora)" },
  { valor: "ELIMINADOS", rotulo: "Eliminados" },
  { valor: "PODE_INCLUIR", rotulo: "Podem entrar por decisão" },
]);

const SITUACOES = new Set<string>(SITUACOES_DAS_PESSOAS.map((s) => s.valor));

const texto = (valor: unknown) =>
  typeof valor === "string" ? valor : valor == null ? "" : String(valor);

/** O filtro guardado na sessão (ou vindo de fora), no formato de agora. */
export function normalizarFiltroDasPessoas(valor: unknown): FiltroDasPessoas {
  const v =
    valor && typeof valor === "object"
      ? (valor as Record<string, unknown>)
      : {};
  const situacao = texto(v.situacao);
  return {
    busca: texto(v.busca).slice(0, 120),
    vaga: texto(v.vaga),
    situacao: SITUACOES.has(situacao)
      ? (situacao as SituacaoDasPessoas)
      : FILTRO_DAS_PESSOAS_INICIAL.situacao,
  };
}

/** Quantos filtros estão em uso (a busca conta). */
export function filtrosDasPessoasEmUso(f: FiltroDasPessoas): number {
  return [
    f.busca.trim(),
    f.vaga,
    f.situacao !== FILTRO_DAS_PESSOAS_INICIAL.situacao ? f.situacao : "",
  ].filter(Boolean).length;
}

/** A chave da sessão: por edital (o filtro de um não vale no outro). */
export const chaveDasPessoas = (editalId: string) =>
  editalId ? `monitora:triagem:pessoas:${editalId}` : "";

/** Os grupos que a situação pede ao banco, na ordem em que aparecem. */
export function gruposDaSituacao(
  situacao: SituacaoDasPessoas,
): readonly GrupoDaPre[] {
  return situacao === "TODAS" ? ["CLASSIFICADOS", "ELIMINADOS"] : [situacao];
}

/** O recorte de um grupo (a busca já aparada; vaga vazia = o edital todo). */
export function recorteDasPessoas(
  f: FiltroDasPessoas,
  grupo: GrupoDaPre,
  busca = f.busca,
): RecorteDaPre {
  return { vaga: f.vaga || null, grupo, busca: busca.trim() };
}

export type AcaoDaPessoa =
  "incluir" | "revogar" | "comunicado" | "copiar" | "ver-vaga";

export interface PessoaDaTriagem {
  situacao?: string | null;
  motivo?: string | null;
  motivo_codigo?: string | null;
  decisao?: unknown;
  entrada?: string | null;
}

/**
 * As ações de uma pessoa: a principal (o botão da linha) e as outras (o
 * "⋯"). Quem não coordena só copia o código e vê a vaga. Incluir e revogar
 * pedem motivo (a gaveta confirma); o comunicado só existe com motivo.
 */
export function acoesDaPessoa(
  c: PessoaDaTriagem,
  { podeCoordenar }: { podeCoordenar: boolean },
): { principal: AcaoDaPessoa | null; outras: AcaoDaPessoa[] } {
  const eliminado = c.situacao === "ELIMINADO";
  const comunicado = eliminado && Boolean(texto(c.motivo).trim());
  const incluir = podeCoordenar && podeIncluirPorDecisao(c);
  const revogar =
    podeCoordenar &&
    !eliminado &&
    Boolean(seloDaDecisao(c as Parameters<typeof seloDaDecisao>[0]));
  const principal: AcaoDaPessoa | null = comunicado
    ? "comunicado"
    : incluir
      ? "incluir"
      : null;
  const outras: AcaoDaPessoa[] = [];
  if (incluir && principal !== "incluir") outras.push("incluir");
  if (revogar) outras.push("revogar");
  outras.push("ver-vaga", "copiar");
  return { principal, outras };
}

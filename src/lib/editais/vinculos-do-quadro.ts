/*
  O vínculo de cada vaga do edital com a linha do quadro de vagas (Anexo II), como
  `obter_quadro_de_vagas` devolve desde a migration 20261118120000 (TA_VAGA_QUADRO_EDITAL):

  - CONFIRMADO: uma linha (pela regra do nome, pelo "CARGO N" do título da Empregare ou pela
    equipe);
  - AMBIGUO: mais de uma linha possível (nome cortado pela Empregare, empate pelo DSEI) ou a
    lotação do nome contradiz a única linha do cargo — com as candidatas;
  - AUSENTE: nenhuma linha. MANUAL sem pendência = a equipe confirmou que a vaga não tem linha;
    com pendência = a linha escolhida saiu do quadro numa reimportação.

  Regras puras da fila (o componente é `src/modulos/editais/vinculos-do-quadro.tsx`): ler o
  payload sem confiar no formato, separar as três situações, ordenar as linhas para escolher
  (candidatas primeiro; sem candidata, pelas palavras em comum com o nome da vaga).
*/

export type SituacaoDoVinculo = "CONFIRMADO" | "AMBIGUO" | "AUSENTE";
export type OrigemDoVinculo = "AUTOMATICO" | "MANUAL";
export type VagasDoEdital =
  "COM_CODIGO" | "NAO_SE_APLICA" | "EXTERNO" | "PENDENTE_INTEGRACAO";

export interface LinhaDoQuadro {
  id: string;
  cargo: string;
  lotacao: string | null;
}

export interface VinculoDaVaga {
  vaga: string;
  nome: string;
  situacao: SituacaoDoVinculo;
  origem: OrigemDoVinculo;
  regra: "NOME" | "TITULO" | null;
  quadro: string | null;
  cargoDoQuadro: string | null;
  lotacaoDoQuadro: string | null;
  candidatas: LinhaDoQuadro[];
  pendencia: string | null;
  confirmadoEm: string | null;
  confirmadoPor: string | null;
}

export interface FilaDoQuadro {
  linhas: LinhaDoQuadro[];
  vinculos: VinculoDaVaga[];
  /** Nulo: o banco ainda não tem o vínculo (antes de 20261118120000); a fila não aparece. */
  vagasDoEdital: VagasDoEdital | null;
  podeEditar: boolean;
}

type Bruto = Record<string, unknown>;

const objeto = (v: unknown): Bruto | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Bruto) : null;
const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function linha(v: unknown): LinhaDoQuadro | null {
  const o = objeto(v);
  const id = texto(o?.["id"]);
  const cargo = texto(o?.["cargo"]);
  return o && id && cargo ? { id, cargo, lotacao: texto(o["lotacao"]) } : null;
}

const SITUACOES: readonly SituacaoDoVinculo[] = [
  "CONFIRMADO",
  "AMBIGUO",
  "AUSENTE",
];
const VAGAS_DO_EDITAL: readonly VagasDoEdital[] = [
  "COM_CODIGO",
  "NAO_SE_APLICA",
  "EXTERNO",
  "PENDENTE_INTEGRACAO",
];

function vinculo(v: unknown): VinculoDaVaga | null {
  const o = objeto(v);
  const vaga = texto(o?.["vaga"]);
  const situacao = SITUACOES.find((s) => s === o?.["situacao"]);
  if (!o || !vaga || !situacao) return null;
  const regra =
    o["regra"] === "NOME" || o["regra"] === "TITULO" ? o["regra"] : null;
  return {
    vaga,
    nome: texto(o["cargo"]) ?? "",
    situacao,
    origem: o["origem"] === "MANUAL" ? "MANUAL" : "AUTOMATICO",
    regra,
    quadro: texto(o["quadro"]),
    cargoDoQuadro: texto(o["cargo_quadro"]),
    lotacaoDoQuadro: texto(o["lotacao_quadro"]),
    candidatas: lista(o["candidatas"])
      .map(linha)
      .filter((l): l is LinhaDoQuadro => l !== null),
    pendencia: texto(o["pendencia"]),
    confirmadoEm: texto(o["confirmado_em"]),
    confirmadoPor: texto(o["confirmado_por"]),
  };
}

/** O payload de `obter_quadro_de_vagas` (ou de quem o devolve) como a fila usa. */
export function filaDoQuadro(dados: unknown): FilaDoQuadro {
  const o = objeto(dados) ?? {};
  const vinculos = lista(o["vinculos"])
    .map(vinculo)
    .filter((v): v is VinculoDaVaga => v !== null);
  const informado = VAGAS_DO_EDITAL.find((s) => s === o["vagas_do_edital"]);
  return {
    linhas: lista(o["linhas"])
      .map(linha)
      .filter((l): l is LinhaDoQuadro => l !== null),
    vinculos,
    vagasDoEdital: informado ?? null,
    podeEditar: o["pode_editar"] === true,
  };
}

/** "Cargo — Lotação" (só o cargo quando a linha não tem lotação). */
export const rotuloDaLinha = (l: {
  cargo: string | null;
  lotacao: string | null;
}): string => [l.cargo, l.lotacao].filter(Boolean).join(" — ");

/** A equipe confirmou que a vaga não tem linha no quadro (o aviso da conferência some). */
export const semLinhaConfirmado = (v: VinculoDaVaga): boolean =>
  v.situacao === "AUSENTE" && v.origem === "MANUAL" && !v.pendencia;

export interface FilaSeparada {
  confirmadas: VinculoDaVaga[];
  ambiguas: VinculoDaVaga[];
  /** As que pedem decisão primeiro (linha que saiu do quadro), depois as da regra, por fim as "sem linha" confirmadas. */
  ausentes: VinculoDaVaga[];
}

const porNome = (a: VinculoDaVaga, b: VinculoDaVaga) =>
  a.nome.localeCompare(b.nome, "pt-BR") ||
  a.vaga.localeCompare(b.vaga, "pt-BR", { numeric: true });

function pesoDaAusente(v: VinculoDaVaga): number {
  if (v.pendencia) return 0;
  return semLinhaConfirmado(v) ? 2 : 1;
}

/** As três situações da fila, cada uma em ordem estável. */
export function separarFila(vinculos: readonly VinculoDaVaga[]): FilaSeparada {
  return {
    confirmadas: vinculos
      .filter((v) => v.situacao === "CONFIRMADO")
      .sort(porNome),
    ambiguas: vinculos.filter((v) => v.situacao === "AMBIGUO").sort(porNome),
    ausentes: vinculos
      .filter((v) => v.situacao === "AUSENTE")
      .sort((a, b) => pesoDaAusente(a) - pesoDaAusente(b) || porNome(a, b)),
  };
}

/** Quantas vagas ainda pedem a decisão da equipe (ambíguas e ausentes que não são "sem linha" confirmado). */
export const pendentesDaFila = (fila: FilaSeparada): number =>
  fila.ambiguas.length +
  fila.ausentes.filter((v) => !semLinhaConfirmado(v)).length;

/** As palavras de um texto, sem acento, caixa e palavras vazias (para ordenar as linhas). */
function palavras(t: string | null): Set<string> {
  const vazias = new Set([
    "a",
    "as",
    "o",
    "os",
    "e",
    "de",
    "do",
    "da",
    "dos",
    "das",
    "em",
    "no",
    "na",
    "para",
  ]);
  return new Set(
    (t ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p && !vazias.has(p)),
  );
}

/**
 * As linhas do quadro para a equipe escolher: as candidatas primeiro (na ordem do quadro);
 * depois as outras, pelas palavras em comum com o nome da vaga (mais primeiro) e na ordem do quadro.
 */
export function linhasParaEscolher(
  v: VinculoDaVaga,
  linhas: readonly LinhaDoQuadro[],
): LinhaDoQuadro[] {
  const candidatas = new Set(v.candidatas.map((c) => c.id));
  const nome = palavras(v.nome);
  const comuns = (l: LinhaDoQuadro) =>
    [...palavras(rotuloDaLinha(l))].filter((p) => nome.has(p)).length;
  return linhas
    .map((l, ordem) => ({
      l,
      ordem,
      candidata: candidatas.has(l.id),
      comuns: comuns(l),
    }))
    .sort(
      (a, b) =>
        Number(b.candidata) - Number(a.candidata) ||
        (a.candidata ? 0 : b.comuns - a.comuns) ||
        a.ordem - b.ordem,
    )
    .map((x) => x.l);
}

/** O que mostrar quando o edital não tem vaga com código para ligar. */
export const TEXTO_DAS_VAGAS_DO_EDITAL: Readonly<
  Record<Exclude<VagasDoEdital, "COM_CODIGO">, string>
> = {
  NAO_SE_APLICA: "Não se aplica: edital cancelado.",
  EXTERNO: "Externo: vagas de outra origem, sem código.",
  PENDENTE_INTEGRACAO: "Pendente de integração: nenhuma vaga com código.",
};

/** Como o vínculo chegou: "Pela regra do nome", "Pelo título da Empregare" ou "Pela equipe". */
export function origemDoVinculo(v: VinculoDaVaga): string {
  if (v.origem === "MANUAL") return "Pela equipe";
  return v.regra === "TITULO"
    ? "Pelo título da Empregare"
    : "Pela regra do nome";
}

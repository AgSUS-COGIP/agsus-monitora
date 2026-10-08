/*
  O catálogo de desempate no assistente da regra (passo 4), agrupado para
  escolher: os critérios da CLASSIFICAÇÃO (src/lib/classificacao/catalogo.js,
  o mesmo do banco) e os da PROVISÓRIA (DESEMPATES_DA_PROVISORIA, que a base
  Python sabe calcular). Os dois catálogos continuam separados: aqui só se
  decide em que grupo cada um aparece, a busca e quais já estão na lista.
*/
import { DESEMPATES_DA_PROVISORIA } from "./catalogo.js";
import { normalizarTexto } from "./nota-declarada.js";
import { CATALOGO_DE_CRITERIOS } from "../classificacao/catalogo.js";

export type GrupoDeDesempate =
  "legal" | "pontuacao" | "experiencia" | "idade" | "outros";

export const GRUPOS_DE_DESEMPATE: ReadonlyArray<[GrupoDeDesempate, string]> =
  Object.freeze([
    ["legal", "Prioridade legal"],
    ["pontuacao", "Pontuação"],
    ["experiencia", "Experiência"],
    ["idade", "Idade"],
    ["outros", "Outros"],
  ]);

export type CriterioDeDesempate = {
  codigo: string;
  nome: string;
  grupo: GrupoDeDesempate;
  /** A direção padrão (só na classificação). */
  direcao?: string;
};

/** O grupo de um critério da classificação. */
export function grupoDoCriterioDaClassificacao(
  codigo: string,
): GrupoDeDesempate {
  if (["IDOSO_60", "INDIGENA_COMPROVADO", "PCD"].includes(codigo))
    return "legal";
  if (codigo === "MAIOR_IDADE") return "idade";
  if (codigo.startsWith("EXP_")) return "experiencia";
  if (codigo.startsWith("NOTA_") || codigo.startsWith("PONTUACAO_"))
    return "pontuacao";
  return "outros";
}

/** O grupo de um desempate da Provisória. */
export function grupoDoDesempateDaProvisoria(codigo: string): GrupoDeDesempate {
  if (codigo === "IDOSO") return "legal";
  if (codigo === "EXPERIENCIA_DECLARADA") return "experiencia";
  if (codigo === "MAIOR_IDADE" || codigo === "MAIS_VELHO") return "idade";
  return "outros";
}

type DoCatalogo = { codigo: string; nome: string; direcao: string };

/** Todo o catálogo de desempate da classificação, na ordem do catálogo. */
export const CRITERIOS_DA_CLASSIFICACAO: ReadonlyArray<CriterioDeDesempate> =
  Object.freeze(
    (CATALOGO_DE_CRITERIOS as unknown as ReadonlyArray<DoCatalogo>).map(
      (c) => ({
        codigo: c.codigo,
        nome: c.nome,
        direcao: c.direcao,
        grupo: grupoDoCriterioDaClassificacao(c.codigo),
      }),
    ),
  );

/** Todo o catálogo de desempate da Provisória. */
export const CRITERIOS_DA_PROVISORIA: ReadonlyArray<CriterioDeDesempate> =
  Object.freeze(
    (
      DESEMPATES_DA_PROVISORIA as unknown as ReadonlyArray<
        readonly [string, string]
      >
    ).map(([codigo, nome]) => ({
      codigo,
      nome,
      grupo: grupoDoDesempateDaProvisoria(codigo),
    })),
  );

export type ItemDoSeletor = CriterioDeDesempate & {
  /** A posição na lista (1º, 2º…) quando já está nela; null quando não. */
  posicao: number | null;
};

export type GrupoDoSeletor = {
  grupo: GrupoDeDesempate;
  titulo: string;
  itens: ItemDoSeletor[];
};

/**
 * O catálogo em grupos (Prioridade legal · Pontuação · Experiência · Idade ·
 * Outros), com a posição dos que já estão na lista e a busca (sem acento, no
 * nome ou no código). Grupo sem item some.
 */
export function catalogoAgrupado(
  catalogo: ReadonlyArray<CriterioDeDesempate>,
  usados: ReadonlyArray<string>,
  busca = "",
): GrupoDoSeletor[] {
  const alvo = normalizarTexto(busca).trim();
  const casa = (c: CriterioDeDesempate) =>
    !alvo ||
    normalizarTexto(c.nome).includes(alvo) ||
    normalizarTexto(c.codigo.replace(/_/g, " ")).includes(alvo);
  return GRUPOS_DE_DESEMPATE.map(([grupo, titulo]) => ({
    grupo,
    titulo,
    itens: catalogo
      .filter((c) => c.grupo === grupo && casa(c))
      .map((c) => {
        const i = usados.indexOf(c.codigo);
        return { ...c, posicao: i < 0 ? null : i + 1 };
      }),
  })).filter((g) => g.itens.length > 0);
}

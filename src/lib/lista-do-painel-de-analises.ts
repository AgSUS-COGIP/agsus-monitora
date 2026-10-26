/*
  A lista enxuta de Análises curriculares (src/modulos/analises/), desde 20260929150000.

  O payload da lista (get_analises_dashboard_payload_v2, schema_version 4) só
  traz o que a lista, os filtros, os KPIs, os gráficos e a tabela usam. O resto
  vem de outro lugar, e as regras de como juntar ficam aqui:

  - `grupo` e `edital_status` vêm uma vez no envelope, não em cada linha;
  - a janela oficial (data_inicio/fim_analise) sai de `editais[]`: o
    tela casa a linha com o edital quando a linha vem sem janela
    (`editalDaLinha` de analises-curriculares.ts), com uma regra que cobre a
    da view;
  - "tem PDF?" vem como `tem_pdf`; o link, no detalhe e no CSV;
  - pontuações, experiências, links e datas ficam no detalhamento
    (get_analise_detalhe_do_painel), buscado ao abrir o registro;
  - "Todos" não tem pacote próprio: são os escopos 'ativo' e 'inativo'
    juntos, na ordem do banco (`juntarPartesDoPainel`). As análises
    desativadas (saíram da planilha, ou ficha fora do lote) não entram no
    painel desde 22/10/2026: os números do "Todos" contavam pendentes e
    revisões que não existem mais.

  O payload antigo (schema 3, com todas as colunas) passa por aqui sem mudar:
  toda regra só completa o que falta na linha.
*/
import type {
  EnvelopeDasAnalises,
  RegistroDaAnalise,
} from "../modulos/analises/tipos.ts";

/** O envelope de um pacote, com os campos que a junção de "Todos" lê. */
export interface EnvelopeDoPainel extends EnvelopeDasAnalises {
  scope?: unknown;
  generated_at?: unknown;
  atualizado_em?: unknown;
  cache?: { hit?: unknown; refreshed_at?: unknown } | null;
  rows?: unknown;
}

/** Uma parte de "Todos": o envelope do pacote e as linhas dele. */
export interface ParteDoPainel {
  payload?: EnvelopeDoPainel | null;
  linhas: readonly RegistroDaAnalise[];
}

const texto = (valor: unknown) => String(valor ?? "").trim();
const temCampo = (objeto: unknown, campo: string) =>
  Boolean(objeto) && Object.prototype.hasOwnProperty.call(objeto, campo);

/* As partes do escopo "Todos", na ordem em que o banco as separa. */
export const PARTES_DE_TODOS: readonly string[] = Object.freeze([
  "ativo",
  "inativo",
]);

/* Os escopos que o painel pede ao servidor para cada situação do filtro. */
export function partesDoEscopo(escopo: string): string[] {
  return escopo === "todos" ? [...PARTES_DE_TODOS] : [escopo];
}

/**
 * Completa a linha com o que o envelope manda uma vez só (grupo e situação do
 * edital) e marca de que pacote ela veio (`__escopo`: 'ativo', 'inativo' ou
 * 'desativadas'), para quem precisa separar as partes de "Todos" (o Ritmo
 * conta só o Ativo).
 */
export function completarLinhaPeloEnvelope<
  L extends RegistroDaAnalise | null | undefined,
>(linha: L, payload: Readonly<RegistroDaAnalise> | null | undefined): L {
  if (!linha || typeof linha !== "object" || !payload) return linha;
  ["grupo", "edital_status"].forEach((campo) => {
    if (!temCampo(linha, campo) && payload[campo] != null)
      (linha as RegistroDaAnalise)[campo] = payload[campo];
  });
  if (
    !temCampo(linha, "__escopo") &&
    PARTES_DE_TODOS.includes(payload.scope as string)
  )
    (linha as RegistroDaAnalise).__escopo = payload.scope;
  return linha;
}

/* O detalhamento ainda não veio para esta linha (lista enxuta)? */
export function linhaSemDetalhe(linha: unknown): boolean {
  return (
    Boolean(linha) &&
    typeof linha === "object" &&
    !temCampo(linha, "pontuacao_escolaridade")
  );
}

/*
  Campos do detalhe que não entram na linha: o id e a área já estão nela, e a
  chave natural faz parte da chave da linha na tabela (mudar a chave com o
  detalhamento aberto o fecharia). O espelho (a entrada do espelho de nota da
  ficha, ~30 KB) é só da gaveta: fica no detalhe, não vai para a linha.
*/
const FORA_DA_LINHA = new Set(["id", "area", "chave_natural", "espelho"]);

/** Põe na linha o que o detalhe trouxe e ela não tem. Devolve se mudou algo. */
export function mesclarDetalhe(
  linha: RegistroDaAnalise | null | undefined,
  detalhe: unknown,
): boolean {
  const dados: unknown = Array.isArray(detalhe) ? detalhe[0] : detalhe;
  if (
    !linha ||
    typeof linha !== "object" ||
    !dados ||
    typeof dados !== "object"
  )
    return false;
  let mudou = false;
  Object.entries(dados).forEach(([campo, valor]) => {
    if (FORA_DA_LINHA.has(campo) || temCampo(linha, campo)) return;
    linha[campo] = valor;
    mudou = true;
  });
  return mudou;
}

/*
  Ordem do banco: unidade, edital, código da vaga e candidato, com a colação
  do banco (ICU en-US) e os nulos no fim; o id (uuid, minúsculo) desempata.
  Cada parte já vem nessa ordem; só a junção precisa comparar.
*/
const COLACAO_DO_BANCO = new Intl.Collator("en-US");
const CAMPOS_DA_ORDEM = ["unidade", "edital", "codigo_vaga", "candidato"];

export function compararNaOrdemDoBanco(
  a: Readonly<RegistroDaAnalise> | null | undefined,
  b: Readonly<RegistroDaAnalise> | null | undefined,
): number {
  for (const campo of CAMPOS_DA_ORDEM) {
    const x = a?.[campo];
    const y = b?.[campo];
    const xNulo = x === null || x === undefined;
    const yNulo = y === null || y === undefined;
    if (xNulo || yNulo) {
      if (xNulo !== yNulo) return xNulo ? 1 : -1;
      continue;
    }
    const ordem = COLACAO_DO_BANCO.compare(String(x), String(y));
    if (ordem) return ordem;
  }
  const idA = texto(a?.id);
  const idB = texto(b?.id);
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

const horaDoPayload = (payload: EnvelopeDoPainel | null | undefined) =>
  Date.parse(payload?.generated_at as string) || 0;

/*
  "Todos": junta as partes (cada uma `{ payload, linhas }`) sem repetir linha e
  na ordem do banco. Uma análise que mudou de escopo entre duas cópias (a do
  navegador e a nova) aparece em duas partes: fica a da parte mais nova.
*/
export function juntarPartesDoPainel(
  partes: readonly (ParteDoPainel | null | undefined)[] | null | undefined,
): RegistroDaAnalise[] {
  const lista = (Array.isArray(partes) ? partes : []).filter(
    (parte) => parte && Array.isArray(parte.linhas),
  ) as ParteDoPainel[];
  const donoDoId = new Map<string, { indice: number; hora: number }>();
  lista.forEach((parte, indice) => {
    const hora = horaDoPayload(parte.payload);
    parte.linhas.forEach((linha) => {
      const id = texto(linha?.id);
      if (!id) return;
      const atual = donoDoId.get(id);
      if (!atual || hora > atual.hora) donoDoId.set(id, { indice, hora });
    });
  });

  const filas = lista.map((parte, indice) =>
    parte.linhas.filter((linha) => {
      const id = texto(linha?.id);
      return !id || donoDoId.get(id)!.indice === indice;
    }),
  );
  const posicoes = filas.map(() => 0);
  const juntas: RegistroDaAnalise[] = [];
  for (;;) {
    let escolhida = -1;
    filas.forEach((fila, indice) => {
      if (posicoes[indice]! >= fila.length) return;
      if (
        escolhida < 0 ||
        compararNaOrdemDoBanco(
          fila[posicoes[indice]!],
          filas[escolhida]![posicoes[escolhida]!],
        ) < 0
      )
        escolhida = indice;
    });
    if (escolhida < 0) break;
    juntas.push(filas[escolhida]![posicoes[escolhida]!]!);
    posicoes[escolhida]! += 1;
  }
  return juntas;
}

/*
  O envelope de "Todos": o da parte mais nova, com a hora da mais antiga (a
  cópia vale o que vale a parte mais velha), o total das linhas juntas e a
  data do dado mais novo.
*/
export function envelopeDeTodos(
  partes: readonly (ParteDoPainel | null | undefined)[] | null | undefined,
  total: number,
): EnvelopeDasAnalises {
  const payloads = (Array.isArray(partes) ? partes : [])
    .map((parte) => parte?.payload)
    .filter(Boolean) as EnvelopeDoPainel[];
  /* Sem parte nenhuma, null; quem chama (consultas.ts) sempre tem as partes. */
  if (!payloads.length) return null as unknown as EnvelopeDasAnalises;
  const maisNovo = payloads.reduce((a, b) =>
    horaDoPayload(b) > horaDoPayload(a) ? b : a,
  );
  const maisVelho = payloads.reduce((a, b) =>
    horaDoPayload(b) < horaDoPayload(a) ? b : a,
  );
  const atualizados = payloads
    .map((payload) => payload.atualizado_em as string)
    .filter((valor) => Date.parse(valor));
  const atualizadoEm = atualizados.length
    ? atualizados.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
    : null;
  const envelope = { ...maisNovo };
  delete envelope.rows;
  return {
    ...envelope,
    scope: "todos",
    edital_status: null,
    total,
    atualizado_em: atualizadoEm,
    generated_at: maisVelho.generated_at,
    cache: {
      hit: payloads.every((payload) => payload.cache?.hit === true),
      refreshed_at: maisVelho.cache?.refreshed_at ?? maisVelho.generated_at,
    },
  };
}

import type { CandidatoDasRegrasDeAprovados } from "./tipos-das-regras-de-aprovados.ts";
import type {
  CandidatoDaConvocacao,
  ConfiguracaoDaVagaParaChamada,
} from "./tipos-da-lista-de-convocacao.ts";
import {
  STATUS_CONTRATADO_EM_OUTRA_LISTA,
  STATUS_CONVOCADO,
  statusEfetivo,
} from "./lista-aprovados-rules.ts";
import {
  montarListaDeConvocacao,
  situacaoNaChamada,
} from "./lista-convocacao-rules.ts";

/*
  RESUMO POR CARGO E STATUS (pedido da CORES, Lista de aprovados)

  "Contagem de candidatos por cargo e status": por edital, cargo + regime +
  jornada, e dentro dele uma linha por vaga e modalidade, com Aprovados,
  Contratados, Desistência voluntária, Desistência tácita e Cadastro de reserva,
  subtotal por grupo e total geral. Tudo é contado aqui, uma vez: a tabela da
  tela, o detalhe nominal e a exportação leem a MESMA estrutura (critério F).

  UNIDADE: o vínculo, uma linha da lista vigente (edital, vaga e modalidade).
  Quem concorre à cota e à ampla tem duas linhas e conta nas duas em
  Aprovados, como a lista do edital publica. Nada se junta por nome; o mesmo
  candidato_id não conta duas vezes.

  CATEGORIAS, EXCLUSIVAS (cada vínculo cai em uma só; a soma fecha Aprovados):
    - Contratados: status efetivo Contratado ou Migração, como nos KPIs, na
      Seleção e na Visão geral (Migração vai também à parte em `migracao`).
      "Contratado em outra lista" NÃO conta: a pessoa já conta pela outra linha.
    - Desistência voluntária / tácita: só com o subtipo REGISTRADO na linha
      (`desistencia_subtipo`). O banco ainda não guarda subtipo: hoje todo
      Desistente cai em "Desistência sem subtipo". Nada é inferido.
    - Cadastro de reserva: a regra da fila de convocação (lista-convocacao-rules,
      situacaoNaChamada): na fila, fora das vagas imediatas e ainda não chamado.
      Nunca "aprovados menos o resto".
    - Outras situações: o que sobra, com o motivo — Convocado, A convocar
      (vaga imediata ainda não chamada), Documentação Rejeitada, Contratado em
      outra lista e Não classificado (fora da fila sem status que a explique).

  LISTA VIGENTE: o pacote da tela já traz só a versão vigente de cada edital.
  A lista inativada (lista_ativa falso, ex.: vencida) fica fora e é contada à
  parte (`foraDaListaAtiva`).

  REGIME E JORNADA: não há campo estruturado (TB_SELECAO_VAGA e a lista só
  têm o texto do cargo). A regra explícita está em `lerRegimeEJornada`: os
  trechos do cargo separados por " - " que forem só o regime (Presencial,
  Teletrabalho, Híbrido, Remoto) ou só a jornada (20h, 40 horas) saem do nome
  do cargo; o que faltar aparece como "não informado" e é contado em `faltas`.
  A vaga é o código da vaga (codigo_vaga); sem código, a linha leva
  "Vaga sem código" e também entra em `faltas`.
*/

export interface CandidatoDoResumo
  extends CandidatoDasRegrasDeAprovados, CandidatoDaConvocacao {
  candidato_id?: unknown;
  edital_id?: unknown;
  classificacao?: unknown;
  codigo_vaga?: unknown;
  /** Subtipo da desistência, quando registrado: VOLUNTARIA ou TACITA (ainda não existe no banco). */
  desistencia_subtipo?: unknown;
}

/** As colunas de contagem, na ordem da tela e do arquivo. */
export const CATEGORIAS_DO_RESUMO = Object.freeze([
  "contratado",
  "desistenciaVoluntaria",
  "desistenciaTacita",
  "desistenciaSemSubtipo",
  "reserva",
  "outras",
] as const);
export type CategoriaDoResumo = (typeof CATEGORIAS_DO_RESUMO)[number];

/** Os motivos de "Outras situações". */
export const MOTIVOS_DE_OUTRAS = Object.freeze([
  "convocado",
  "aConvocar",
  "documentacaoRejeitada",
  "contratadoEmOutraLista",
  "naoClassificado",
] as const);
export type MotivoDeOutras = (typeof MOTIVOS_DE_OUTRAS)[number];

export type ColunaDoResumo = "aprovados" | CategoriaDoResumo;

export const ROTULO_DA_COLUNA: Readonly<Record<ColunaDoResumo, string>> =
  Object.freeze({
    aprovados: "Aprovados",
    contratado: "Contratados",
    desistenciaVoluntaria: "Desistência voluntária",
    desistenciaTacita: "Desistência tácita",
    desistenciaSemSubtipo: "Desistência sem subtipo",
    reserva: "Cadastro de reserva",
    outras: "Outras situações",
  });

export const ROTULO_DO_MOTIVO: Readonly<Record<MotivoDeOutras, string>> =
  Object.freeze({
    convocado: "Convocado",
    aConvocar: "A convocar (vaga imediata)",
    documentacaoRejeitada: "Documentação rejeitada",
    contratadoEmOutraLista: "Contratado em outra lista",
    naoClassificado: "Não classificado",
  });

export const COLUNAS_DO_RESUMO: readonly ColunaDoResumo[] = Object.freeze([
  "aprovados",
  ...CATEGORIAS_DO_RESUMO,
]);

export interface ContagemDoResumo {
  aprovados: number;
  contratado: number;
  desistenciaVoluntaria: number;
  desistenciaTacita: number;
  desistenciaSemSubtipo: number;
  reserva: number;
  outras: number;
  /** Dos contratados, quantos por Migração. */
  migracao: number;
  /** Os motivos de "Outras situações" (somam `outras`). */
  motivos: Record<MotivoDeOutras, number>;
  /** Informativo, não exclusivo: vínculos sub judice. */
  subJudice: number;
}

/** Os vínculos de cada coluna (ids), para o detalhe nominal abrir o mesmo recorte. */
export type IdsDoResumo = Record<ColunaDoResumo, string[]>;

export interface LinhaDoResumo {
  chave: string;
  codigoVaga: string;
  unidade: string;
  cargo: string;
  modalidade: string;
  contagem: ContagemDoResumo;
  ids: IdsDoResumo;
}

export interface GrupoDoResumo {
  chave: string;
  cargoBase: string;
  regime: string | null;
  jornada: string | null;
  /** "Cargo · Regime · Jornada", com "não informado" no que faltar. */
  rotulo: string;
  linhas: LinhaDoResumo[];
  subtotal: ContagemDoResumo;
  ids: IdsDoResumo;
}

export interface EditalDoResumo {
  editalId: string;
  rotulo: string;
  grupos: GrupoDoResumo[];
  subtotal: ContagemDoResumo;
  ids: IdsDoResumo;
}

export interface FaltasDoResumo {
  semRegime: number;
  semJornada: number;
  semCodigoDaVaga: number;
  semModalidade: number;
}

export interface ResumoPorCargoEStatus {
  editais: EditalDoResumo[];
  total: ContagemDoResumo;
  ids: IdsDoResumo;
  /** Vínculos que ficaram fora por estarem em lista inativa. */
  foraDaListaAtiva: number;
  /** Algum vínculo traz o subtipo da desistência registrado. */
  subtipoRegistrado: boolean;
  faltas: FaltasDoResumo;
}

/** A situação de cada vínculo na fila de convocação (situacaoNaChamada). */
export type SituacoesNaFila = ReadonlyMap<string, string>;

const texto = (valor: unknown) => String(valor ?? "").trim();
const COLACAO = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});

/* ── Regime e jornada a partir do texto do cargo ──────────────────────── */

const REGIMES: readonly [RegExp, string][] = [
  [/^presencial$/i, "Presencial"],
  [/^teletrabalho$/i, "Teletrabalho"],
  [/^h[ií]brido$/i, "Híbrido"],
  [/^remoto$/i, "Remoto"],
];
const JORNADA = /^(\d{1,2})\s*(?:h|hs|horas?)(?:\s*semanais)?$/i;

/**
 * O cargo sem o regime e a jornada, e os dois à parte. Regra: o texto do cargo
 * separado por " - " (hífen, meia-risca ou travessão com espaços); um trecho
 * que é só o regime ou só a jornada sai do nome. Sem o trecho, null.
 */
export function lerRegimeEJornada(cargo: unknown): {
  cargoBase: string;
  regime: string | null;
  jornada: string | null;
} {
  const trechos = texto(cargo)
    .split(/\s+[-–—]\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  let regime: string | null = null;
  let jornada: string | null = null;
  const restantes = trechos.filter((trecho) => {
    const achado = REGIMES.find(([padrao]) => padrao.test(trecho));
    if (achado && regime === null) {
      regime = achado[1];
      return false;
    }
    const horas = trecho.match(JORNADA);
    if (horas && jornada === null) {
      jornada = `${Number(horas[1])}h`;
      return false;
    }
    return true;
  });
  return {
    cargoBase: restantes.join(" - ") || texto(cargo),
    regime,
    jornada,
  };
}

/* ── Fila de convocação ───────────────────────────────────────────────── */

/**
 * A situação de cada vínculo na fila, pela mesma conta da aba Convocação.
 * `candidatos` tem de ser a lista inteira de cada vaga (no máximo recortada
 * por edital e cargo): modalidade e situação mudariam a ordem da fila.
 */
export function situacoesNaFila<T extends CandidatoDaConvocacao>(
  candidatos: readonly T[] | null | undefined,
  obterConfiguracao: (
    editalId: string,
    codigoVaga: string,
  ) => ConfiguracaoDaVagaParaChamada | null | undefined,
): Map<string, string> {
  const situacoes = new Map<string, string>();
  for (const grupo of montarListaDeConvocacao(candidatos, obterConfiguracao)) {
    for (const linha of [...grupo.linhas, ...grupo.foraDaFila])
      situacoes.set(
        texto(linha.candidato.candidato_id),
        situacaoNaChamada(linha),
      );
  }
  return situacoes;
}

/* ── Categoria de um vínculo ──────────────────────────────────────────── */

export function categoriaDoVinculo(
  candidato: CandidatoDoResumo,
  situacaoNaFila: string | undefined,
): { categoria: CategoriaDoResumo; motivo: MotivoDeOutras | null } {
  const status = statusEfetivo(candidato);
  if (status === "Contratado" || status === "Migração")
    return { categoria: "contratado", motivo: null };
  if (status === "Desistente") {
    const subtipo = texto(candidato.desistencia_subtipo).toUpperCase();
    if (subtipo === "VOLUNTARIA")
      return { categoria: "desistenciaVoluntaria", motivo: null };
    if (subtipo === "TACITA")
      return { categoria: "desistenciaTacita", motivo: null };
    return { categoria: "desistenciaSemSubtipo", motivo: null };
  }
  if (status === STATUS_CONVOCADO)
    return { categoria: "outras", motivo: "convocado" };
  if (status === "Documentação Rejeitada")
    return { categoria: "outras", motivo: "documentacaoRejeitada" };
  if (status === STATUS_CONTRATADO_EM_OUTRA_LISTA)
    return { categoria: "outras", motivo: "contratadoEmOutraLista" };
  if (!status && situacaoNaFila === "Cadastro de reserva")
    return { categoria: "reserva", motivo: null };
  if (!status && situacaoNaFila === "A convocar")
    return { categoria: "outras", motivo: "aConvocar" };
  return { categoria: "outras", motivo: "naoClassificado" };
}

/* ── Contagem ─────────────────────────────────────────────────────────── */

export function contagemVazia(): ContagemDoResumo {
  return {
    aprovados: 0,
    contratado: 0,
    desistenciaVoluntaria: 0,
    desistenciaTacita: 0,
    desistenciaSemSubtipo: 0,
    reserva: 0,
    outras: 0,
    migracao: 0,
    motivos: {
      convocado: 0,
      aConvocar: 0,
      documentacaoRejeitada: 0,
      contratadoEmOutraLista: 0,
      naoClassificado: 0,
    },
    subJudice: 0,
  };
}

const idsVazios = (): IdsDoResumo => ({
  aprovados: [],
  contratado: [],
  desistenciaVoluntaria: [],
  desistenciaTacita: [],
  desistenciaSemSubtipo: [],
  reserva: [],
  outras: [],
});

function somar(alvo: ContagemDoResumo, parte: ContagemDoResumo) {
  for (const coluna of COLUNAS_DO_RESUMO) alvo[coluna] += parte[coluna];
  alvo.migracao += parte.migracao;
  alvo.subJudice += parte.subJudice;
  for (const motivo of MOTIVOS_DE_OUTRAS)
    alvo.motivos[motivo] += parte.motivos[motivo];
}

function juntarIds(alvo: IdsDoResumo, parte: IdsDoResumo) {
  for (const coluna of COLUNAS_DO_RESUMO) alvo[coluna].push(...parte[coluna]);
}

/** A soma das categorias fecha Aprovados (critério E). */
export function reconcilia(contagem: ContagemDoResumo) {
  const soma = CATEGORIAS_DO_RESUMO.reduce((s, c) => s + contagem[c], 0);
  const motivos = MOTIVOS_DE_OUTRAS.reduce(
    (s, m) => s + contagem.motivos[m],
    0,
  );
  return soma === contagem.aprovados && motivos === contagem.outras;
}

const naoInformado = (valor: string | null, nome: string) =>
  valor ?? `${nome} não informado`;

/**
 * O resumo dos vínculos que passaram pelos filtros da tela. `situacoes` vem de
 * `situacoesNaFila` sobre a lista inteira das vagas. `rotulosDosEditais`:
 * edital_id → rótulo (o do filtro de edital da tela).
 */
export function montarResumoPorCargoEStatus({
  candidatos,
  situacoes,
  rotulosDosEditais = new Map(),
}: {
  candidatos: readonly CandidatoDoResumo[] | null | undefined;
  situacoes: SituacoesNaFila;
  rotulosDosEditais?: ReadonlyMap<string, string>;
}): ResumoPorCargoEStatus {
  const faltas: FaltasDoResumo = {
    semRegime: 0,
    semJornada: 0,
    semCodigoDaVaga: 0,
    semModalidade: 0,
  };
  let foraDaListaAtiva = 0;
  let subtipoRegistrado = false;
  const vistos = new Set<string>();
  const editais = new Map<
    string,
    {
      rotulo: string;
      grupos: Map<
        string,
        Omit<GrupoDoResumo, "subtotal" | "ids"> & { linhas: LinhaDoResumo[] }
      >;
    }
  >();
  const linhas = new Map<string, LinhaDoResumo>();

  for (const candidato of candidatos || []) {
    const id = texto(candidato.candidato_id);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    if (candidato.lista_ativa === false) {
      foraDaListaAtiva += 1;
      continue;
    }
    if (texto(candidato.desistencia_subtipo)) subtipoRegistrado = true;

    const editalId = texto(candidato.edital_id);
    const cargo = texto(candidato.cargo);
    const { cargoBase, regime, jornada } = lerRegimeEJornada(cargo);
    const codigoVaga = texto(candidato.codigo_vaga);
    const modalidade = texto(candidato.modalidade);
    if (!regime) faltas.semRegime += 1;
    if (!jornada) faltas.semJornada += 1;
    if (!codigoVaga) faltas.semCodigoDaVaga += 1;
    if (!modalidade) faltas.semModalidade += 1;

    if (!editais.has(editalId))
      editais.set(editalId, {
        rotulo:
          rotulosDosEditais.get(editalId) ||
          [texto(candidato.edital) || "Edital", texto(candidato.unidade)]
            .filter(Boolean)
            .join(" · "),
        grupos: new Map(),
      });
    const edital = editais.get(editalId)!;
    const chaveDoGrupo = [
      editalId,
      cargoBase,
      regime ?? "",
      jornada ?? "",
    ].join("\u0000");
    if (!edital.grupos.has(chaveDoGrupo))
      edital.grupos.set(chaveDoGrupo, {
        chave: chaveDoGrupo,
        cargoBase,
        regime,
        jornada,
        rotulo: [
          cargoBase,
          naoInformado(regime, "Regime"),
          naoInformado(jornada, "Jornada"),
        ].join(" · "),
        linhas: [],
      });
    const grupo = edital.grupos.get(chaveDoGrupo)!;
    // Vaga distinta, linha distinta (critério A): o código, ou o cargo inteiro sem código.
    const chaveDaLinha = [
      chaveDoGrupo,
      codigoVaga || `cargo:${cargo}`,
      modalidade,
    ].join("\u0000");
    let linha = linhas.get(chaveDaLinha);
    if (!linha) {
      linha = {
        chave: chaveDaLinha,
        codigoVaga,
        unidade: texto(candidato.unidade),
        cargo,
        modalidade: modalidade || "Modalidade não informada",
        contagem: contagemVazia(),
        ids: idsVazios(),
      };
      linhas.set(chaveDaLinha, linha);
      grupo.linhas.push(linha);
    }

    const { categoria, motivo } = categoriaDoVinculo(
      candidato,
      situacoes.get(id),
    );
    linha.contagem.aprovados += 1;
    linha.ids.aprovados.push(id);
    linha.contagem[categoria] += 1;
    linha.ids[categoria].push(id);
    if (motivo) linha.contagem.motivos[motivo] += 1;
    if (statusEfetivo(candidato) === "Migração") linha.contagem.migracao += 1;
    if (candidato.sub_judice) linha.contagem.subJudice += 1;
  }

  const total = contagemVazia();
  const idsDoTotal = idsVazios();
  const listaDeEditais: EditalDoResumo[] = [...editais.entries()]
    .map(([editalId, edital]) => {
      const subtotalDoEdital = contagemVazia();
      const idsDoEdital = idsVazios();
      const grupos = [...edital.grupos.values()]
        .map((g) => {
          const subtotal = contagemVazia();
          const ids = idsVazios();
          g.linhas.sort(
            (a, b) =>
              COLACAO.compare(a.codigoVaga, b.codigoVaga) ||
              COLACAO.compare(a.cargo, b.cargo) ||
              COLACAO.compare(a.modalidade, b.modalidade),
          );
          for (const l of g.linhas) {
            somar(subtotal, l.contagem);
            juntarIds(ids, l.ids);
          }
          return { ...g, subtotal, ids };
        })
        .sort(
          (a, b) =>
            COLACAO.compare(a.cargoBase, b.cargoBase) ||
            COLACAO.compare(a.regime ?? "~", b.regime ?? "~") ||
            COLACAO.compare(a.jornada ?? "~", b.jornada ?? "~"),
        );
      for (const g of grupos) {
        somar(subtotalDoEdital, g.subtotal);
        juntarIds(idsDoEdital, g.ids);
      }
      somar(total, subtotalDoEdital);
      juntarIds(idsDoTotal, idsDoEdital);
      return {
        editalId,
        rotulo: edital.rotulo,
        grupos,
        subtotal: subtotalDoEdital,
        ids: idsDoEdital,
      };
    })
    .sort((a, b) => COLACAO.compare(a.rotulo, b.rotulo));

  return {
    editais: listaDeEditais,
    total,
    ids: idsDoTotal,
    foraDaListaAtiva,
    subtipoRegistrado,
    faltas,
  };
}

/* ── Linhas planas: a mesma estrutura para o arquivo ──────────────────── */

export type NivelDaLinhaDoResumo = "Vaga" | "Subtotal" | "Edital" | "Total";

export interface LinhaPlanaDoResumo {
  nivel: NivelDaLinhaDoResumo;
  edital: string;
  grupo: string;
  codigoVaga: string;
  unidade: string;
  modalidade: string;
  contagem: ContagemDoResumo;
}

/**
 * Vaga a vaga, com o subtotal de cada grupo, o de cada edital (quando há mais
 * de um) e o total geral: a ordem da tela.
 */
export function linhasPlanasDoResumo(
  resumo: ResumoPorCargoEStatus,
): LinhaPlanaDoResumo[] {
  const planas: LinhaPlanaDoResumo[] = [];
  const variosEditais = resumo.editais.length > 1;
  for (const edital of resumo.editais) {
    for (const grupo of edital.grupos) {
      for (const linha of grupo.linhas)
        planas.push({
          nivel: "Vaga",
          edital: edital.rotulo,
          grupo: grupo.rotulo,
          codigoVaga: linha.codigoVaga,
          unidade: linha.unidade,
          modalidade: linha.modalidade,
          contagem: linha.contagem,
        });
      planas.push({
        nivel: "Subtotal",
        edital: edital.rotulo,
        grupo: grupo.rotulo,
        codigoVaga: "",
        unidade: "",
        modalidade: "",
        contagem: grupo.subtotal,
      });
    }
    if (variosEditais)
      planas.push({
        nivel: "Edital",
        edital: edital.rotulo,
        grupo: "",
        codigoVaga: "",
        unidade: "",
        modalidade: "",
        contagem: edital.subtotal,
      });
  }
  planas.push({
    nivel: "Total",
    edital: "",
    grupo: "",
    codigoVaga: "",
    unidade: "",
    modalidade: "",
    contagem: resumo.total,
  });
  return planas;
}

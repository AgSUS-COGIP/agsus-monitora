import type {
  DadosDoRecurso,
  RecursoDoPainel,
  EtapaDoRecurso,
  TomDoRecurso,
  OrigemDoRecurso,
  FiltrosDosRecursos,
  RascunhoDoRecurso,
  DetalheParaRascunho,
  IdentificadorDoRecurso,
  DataDoRecurso,
} from "./tipos-dos-recursos.ts";
/*
  A aba Recursos sem DOM: situações, etapas, o que se calcula de cada recurso
  (nota mudou, dias em aberto, prazo, atraso), os indicadores, as pendências
  prioritárias, os filtros, os gráficos, o CSV e a validação do formulário.

  O recurso chega de `get_recursos_da_area` (supabase/migrations/
  20260929120000_recursos.sql) já com o candidato, a vaga, a nota e o resultado
  da análise curricular ligada; o prazo sai do cronograma do edital por
  `prazo-do-recurso.ts`. A tela é `src/modulos/recursos/`.

  Substitui o painel de recursos do Apps Script: mesmas colunas (edital, cargo,
  vaga, origem, analista, código e nome do candidato, situação e as etapas), os
  mesmos indicadores e pendências — agora com prazo, dias em aberto e "a nota
  mudou" calculados, sem digitar.
*/
import { hojeEmBrasilia } from "./cronograma-do-edital.js";
import { sanitizeCsvCell } from "./csv-security.js";
import {
  cronogramasPorEdital,
  decididoNoPrazo,
  prazoDoRecurso,
} from "./prazo-do-recurso.ts";

/*
  As situações do fluxo com parecer jurídico
  (20261001170000_recursos_parecer_juridico.sql; transições em
  parecer-do-recurso.js). PARCIALMENTE_INDEFERIDO é o código de sempre (os
  modelos de resposta o usam); na tela, "Deferido parcialmente".
*/
export const SITUACOES: readonly {
  id: string;
  rotulo: string;
  tom: TomDoRecurso;
}[] = Object.freeze([
  Object.freeze({ id: "REGISTRADO", rotulo: "Registrado", tom: "neutral" }),
  Object.freeze({
    id: "EM_ANALISE_JURIDICA",
    rotulo: "Em análise jurídica",
    tom: "warning",
  }),
  Object.freeze({ id: "DEFERIDO", rotulo: "Deferido", tom: "success" }),
  Object.freeze({
    id: "PARCIALMENTE_INDEFERIDO",
    rotulo: "Deferido parcialmente",
    tom: "info",
  }),
  Object.freeze({ id: "INDEFERIDO", rotulo: "Indeferido", tom: "danger" }),
]);

export const SITUACAO_INICIAL = "REGISTRADO";
export const SITUACAO_EM_PARECER = "EM_ANALISE_JURIDICA";
export const SITUACOES_DECIDIDAS = Object.freeze([
  "DEFERIDO",
  "PARCIALMENTE_INDEFERIDO",
  "INDEFERIDO",
]);
/** Deferido, inclusive o parcialmente. */
export const SITUACOES_DEFERIDAS = Object.freeze([
  "DEFERIDO",
  "PARCIALMENTE_INDEFERIDO",
]);
export const situacaoDecidida = (id: unknown) =>
  typeof id === "string" && SITUACOES_DECIDIDAS.includes(id);

/* Filtro de situação que junta mais de uma (o KPI "Deferidos"). */
export const GRUPOS_DE_SITUACAO: Readonly<
  Record<string, { rotulo: string; situacoes: readonly string[] }>
> = Object.freeze({
  deferidos: Object.freeze({
    rotulo: "Deferidos (com parcialmente)",
    situacoes: SITUACOES_DEFERIDAS,
  }),
});

/* As etapas da esteira, na ordem do trabalho. `campo` é a data que o banco devolve. */
export const ETAPAS: readonly {
  id: EtapaDoRecurso;
  rotulo: string;
  curto: string;
  campo: `${EtapaDoRecurso}_em`;
}[] = Object.freeze([
  Object.freeze({
    id: "download_empregare",
    rotulo: "Documentação baixada (Empregare)",
    curto: "Documentação baixada",
    campo: "download_empregare_em",
  }),
  Object.freeze({
    id: "processo_sei",
    rotulo: "Processo SEI criado",
    curto: "Processo SEI criado",
    campo: "processo_sei_em",
  }),
  Object.freeze({
    id: "upload_sei",
    rotulo: "Documentação juntada no SEI",
    curto: "Documentação no SEI",
    campo: "upload_sei_em",
  }),
  Object.freeze({
    id: "resposta_candidato",
    rotulo: "Resposta enviada ao candidato",
    curto: "Resposta enviada",
    campo: "resposta_candidato_em",
  }),
]);

export const ORIGENS_PADRAO = Object.freeze([
  Object.freeze({
    id: "analise-curricular",
    rotulo: "Análise curricular",
    ativo: true,
  }),
  Object.freeze({ id: "entrevista", rotulo: "Entrevista", ativo: true }),
  Object.freeze({
    id: "resultado-final",
    rotulo: "Resultado final",
    ativo: true,
  }),
]);

const SEM_ANALISTA = "Sem analista";
const texto = (valor: unknown) => String(valor ?? "").trim();
const DIA = 24 * 60 * 60 * 1000;

export function normalizarBusca(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const rotuloDaSituacao = (id: unknown) =>
  SITUACOES.find((s) => s.id === id)?.rotulo || texto(id) || "Registrado";
export const tomDaSituacao = (id: unknown) =>
  SITUACOES.find((s) => s.id === id)?.tom || "neutral";
export const rotuloDaOrigem = (
  id: unknown,
  origens: readonly OrigemDoRecurso[] = ORIGENS_PADRAO,
) => origens.find((o) => o.id === id)?.rotulo || texto(id) || "Sem origem";

/*
  Data do dia (AAAA-MM-DD) em Brasília, como no resto do sistema: prazo é
  data, não instante, e não muda com o fuso do computador de quem usa.
*/
export function diaEmBrasilia(data: DataDoRecurso = new Date()) {
  const d = data instanceof Date ? data : new Date(data);
  return Number.isNaN(d.getTime()) ? "" : hojeEmBrasilia(d);
}

/* Dias inteiros entre duas datas AAAA-MM-DD (b − a). */
const emUtc = (dia: string) => {
  const [ano = 0, mes = 0, d = 0] = dia.split("-").map(Number);
  return Date.UTC(ano, mes - 1, d);
};

export function diasEntre(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  if (!a || !b) return null;
  return Math.round((emUtc(b) - emUtc(a)) / DIA);
}

const nota = (valor: unknown) =>
  valor === null || valor === undefined || valor === ""
    ? null
    : Number.isFinite(Number(valor))
      ? Number(valor)
      : null;

/*
  A nota mudou quando a nota atual da análise é outra que a guardada no dia do
  cadastro. Fora das análises (sem nota), não há como saber: não mudou.
*/
export function notaMudou(
  recurso:
    Pick<DadosDoRecurso, "nota_anterior" | "nota_atual"> | null | undefined,
) {
  const antes = nota(recurso?.nota_anterior);
  const agora = nota(recurso?.nota_atual);
  if (antes === null || agora === null) return false;
  return Math.abs(antes - agora) > 1e-9;
}

/**
 * O recurso com o que se calcula dele. `cronogramas` é o mapa edital →
 * etapas (`cronogramasPorEdital`); `hoje`, a data AAAA-MM-DD.
 */
export function enriquecerRecurso<T extends DadosDoRecurso>(
  recurso: T,
  {
    cronogramas,
    hoje,
  }: { cronogramas?: ReturnType<typeof cronogramasPorEdital>; hoje: string },
) {
  const etapas = {
    download_empregare: Boolean(recurso.download_empregare_em),
    processo_sei: Boolean(recurso.processo_sei_em),
    upload_sei: Boolean(recurso.upload_sei_em),
    resposta_candidato: Boolean(recurso.resposta_candidato_em),
  };
  const situacao = texto(recurso.situacao) || SITUACAO_INICIAL;
  const decidido = situacaoDecidida(situacao);
  const mudouNota = notaMudou(recurso);
  const mudouClassificacao = Boolean(recurso.mudou_classificacao);
  const prazo = prazoDoRecurso(
    cronogramas?.get(String(recurso.edital_id)) || [],
    recurso.origem,
  );
  const inicio = diaEmBrasilia(recurso.criado_em);
  const fim =
    decidido && recurso.decisao_em ? diaEmBrasilia(recurso.decisao_em) : hoje;
  const diasEmAberto = inicio ? Math.max(0, diasEntre(inicio, fim) ?? 0) : null;
  const diasParaPrazo = prazo.data ? diasEntre(hoje, prazo.data) : null;
  const semResposta = !etapas.resposta_candidato;
  return {
    ...recurso,
    situacao,
    analista: texto(recurso.analista),
    etapas,
    decidido,
    mudouNota,
    mudouClassificacao,
    mudouResultado: mudouNota || mudouClassificacao,
    prazo,
    diasEmAberto,
    diasParaPrazo,
    // Atrasado: a resposta ainda não saiu e o prazo já passou.
    atrasado: semResposta && diasParaPrazo !== null && diasParaPrazo < 0,
    // Vencendo: sem resposta e o prazo vence hoje ou em até 2 dias.
    vencendo:
      semResposta &&
      diasParaPrazo !== null &&
      diasParaPrazo >= 0 &&
      diasParaPrazo <= 2,
    // O fluxo do parecer: aguardando o jurídico, ou devolvido por ele para ajuste.
    aguardandoParecer: situacao === SITUACAO_EM_PARECER,
    devolvido: situacao === SITUACAO_INICIAL && Boolean(recurso.devolvido_em),
    // Decidido dentro do prazo do cronograma (true/false); null sem decisão ou prazo.
    noPrazo:
      decidido && recurso.decisao_em
        ? decididoNoPrazo(diaEmBrasilia(recurso.decisao_em), prazo.data)
        : null,
    etapasFeitas: ETAPAS.filter((etapa) => etapas[etapa.id]).length,
    // A resposta escrita no sistema (resposta-do-recurso.js) e os anexos ativos.
    respostaEstado: recurso.resposta_estado || null,
    qtAnexos: Number(recurso.qt_anexos) || 0,
  };
}

export function enriquecerRecursos<T extends DadosDoRecurso>(
  dados:
    | {
        cronogramas?: Parameters<typeof cronogramasPorEdital>[0];
        recursos?: readonly T[] | null;
      }
    | null
    | undefined,
  hoje = diaEmBrasilia(),
) {
  const cronogramas = cronogramasPorEdital(dados?.cronogramas);
  return (Array.isArray(dados?.recursos) ? dados.recursos : []).map((r: T) =>
    enriquecerRecurso(r, { cronogramas, hoje }),
  );
}

/* Pendências: a chave filtra a tabela; o teste diz quem entra. */
export const PENDENCIAS: readonly {
  chave: string;
  titulo: string;
  severidade: "alta" | "media" | "baixa";
  teste: (recurso: RecursoDoPainel) => unknown;
}[] = Object.freeze([
  Object.freeze({
    chave: "prazo_vencido",
    titulo: "Prazo de resposta vencido",
    severidade: "alta",
    teste: (r: RecursoDoPainel) => r.atrasado,
  }),
  Object.freeze({
    chave: "prazo_vencendo",
    titulo: "Prazo vence em até 2 dias",
    severidade: "alta",
    teste: (r: RecursoDoPainel) => r.vencendo,
  }),
  Object.freeze({
    chave: "devolvido",
    titulo: "Devolvidos pelo jurídico",
    severidade: "alta",
    teste: (r: RecursoDoPainel) => r.devolvido,
  }),
  Object.freeze({
    chave: "sem_envio_parecer",
    titulo: "Registrados sem envio ao jurídico",
    severidade: "media",
    teste: (r: RecursoDoPainel) => r.situacao === SITUACAO_INICIAL,
  }),
  Object.freeze({
    chave: "sem_analista",
    titulo: "Sem analista responsável",
    severidade: "alta",
    teste: (r: RecursoDoPainel) => !r.analista,
  }),
  Object.freeze({
    chave: "sem_sei",
    titulo: "Sem processo SEI",
    severidade: "alta",
    teste: (r: RecursoDoPainel) => !r.etapas.processo_sei,
  }),
  Object.freeze({
    chave: "sem_upload_sei",
    titulo: "Sem documentação no SEI",
    severidade: "media",
    teste: (r: RecursoDoPainel) =>
      r.etapas.processo_sei && !r.etapas.upload_sei,
  }),
  Object.freeze({
    chave: "sem_resposta",
    titulo: "Decididos sem resposta ao candidato",
    severidade: "alta",
    teste: (r: RecursoDoPainel) => r.decidido && !r.etapas.resposta_candidato,
  }),
  Object.freeze({
    chave: "resposta_devolvida",
    titulo: "Respostas devolvidas",
    severidade: "alta",
    teste: (r: RecursoDoPainel) => r.respostaEstado === "devolvida",
  }),
  Object.freeze({
    chave: "resposta_aprovada",
    titulo: "Respostas aprovadas aguardando envio",
    severidade: "alta",
    teste: (r: RecursoDoPainel) => r.respostaEstado === "aprovada",
  }),
  Object.freeze({
    chave: "resposta_em_revisao",
    titulo: "Respostas em revisão",
    severidade: "media",
    teste: (r: RecursoDoPainel) => r.respostaEstado === "em_revisao",
  }),
  Object.freeze({
    chave: "mudou_resultado",
    titulo: "Mudança de nota ou classificação",
    severidade: "media",
    teste: (r: RecursoDoPainel) => r.mudouResultado,
  }),
  Object.freeze({
    chave: "sem_prazo",
    titulo: "Prazo não encontrado no cronograma",
    severidade: "baixa",
    teste: (r: RecursoDoPainel) => !r.prazo.data,
  }),
  Object.freeze({
    chave: "fora_analise",
    titulo: "Candidato fora das análises",
    severidade: "baixa",
    teste: (r: RecursoDoPainel) => r.fora_analise,
  }),
]);

/** As pendências com ocorrência, na ordem de prioridade. */
export function pendenciasPrioritarias(recursos: readonly RecursoDoPainel[]) {
  return PENDENCIAS.map(({ teste, ...pendencia }) => ({
    ...pendencia,
    valor: recursos.filter(teste).length,
  })).filter((pendencia) => pendencia.valor > 0);
}

/*
  Os números da tela. Os 4 KPIs usam aguardandoParecer, atrasados, deferidos
  (com os parcialmente) e indeferidos; total e taxa de decisão vão para a
  contagem da fila e o recorte; o resto é pendência ou gráfico.
*/
export function calcularIndicadores(recursos: readonly RecursoDoPainel[]) {
  const total = recursos.length;
  const concluidos = recursos.filter((r) => r.decidido).length;
  const conta = (teste: (recurso: RecursoDoPainel) => boolean) =>
    recursos.filter(teste).length;
  return {
    total,
    registrados: conta((r) => r.situacao === SITUACAO_INICIAL),
    aguardandoParecer: conta((r) => r.aguardandoParecer),
    concluidos,
    deferidos: conta((r) => SITUACOES_DEFERIDAS.includes(r.situacao)),
    indeferidos: conta((r) => r.situacao === "INDEFERIDO"),
    atrasados: conta((r) => r.atrasado),
    vencendo: conta((r) => r.vencendo),
    taxaConclusao: total ? Math.round((concluidos / total) * 100) : 0,
  };
}

/* ── Filtros ─────────────────────────────────────────────────────────── */

export const FILTROS_VAZIOS: Readonly<FiltrosDosRecursos> = Object.freeze({
  edital: "",
  origem: "",
  analista: "",
  situacao: "",
  pendencia: "",
  busca: "",
});

export const IMPACTOS: readonly {
  id: string;
  rotulo: string;
  teste: (recurso: RecursoDoPainel) => boolean;
}[] = Object.freeze([
  Object.freeze({
    id: "nota",
    rotulo: "Mudou a nota",
    teste: (r: RecursoDoPainel) => r.mudouNota,
  }),
  Object.freeze({
    id: "classificacao",
    rotulo: "Mudou a classificação",
    teste: (r: RecursoDoPainel) => r.mudouClassificacao,
  }),
  Object.freeze({
    id: "sem",
    rotulo: "Sem alteração",
    teste: (r: RecursoDoPainel) => !r.mudouResultado,
  }),
]);

const nomeDoAnalista = (r: Pick<RecursoDoPainel, "analista">) =>
  r.analista || SEM_ANALISTA;

export function filtrarRecursos<T extends RecursoDoPainel>(
  recursos: readonly T[],
  filtros: Readonly<FiltrosDosRecursos> = FILTROS_VAZIOS,
) {
  const busca = normalizarBusca(filtros.busca);
  const pendencia = PENDENCIAS.find((p) => p.chave === filtros.pendencia);
  return recursos.filter((r) => {
    if (filtros.edital && String(r.edital_id) !== filtros.edital) return false;
    if (filtros.origem && r.origem !== filtros.origem) return false;
    if (filtros.analista && nomeDoAnalista(r) !== filtros.analista)
      return false;
    if (filtros.situacao) {
      const grupo = GRUPOS_DE_SITUACAO[filtros.situacao];
      const vale = grupo
        ? grupo.situacoes.includes(r.situacao)
        : r.situacao === filtros.situacao;
      if (!vale) return false;
    }
    if (pendencia && !pendencia.teste(r)) return false;
    if (!busca) return true;
    return normalizarBusca(
      [
        r.nu,
        r.candidato,
        r.codigo,
        r.cargo,
        r.vaga,
        r.edital,
        r.unidade,
        r.analista,
        r.processo_sei,
      ].join(" "),
    ).includes(busca);
  });
}

const porTexto = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

/* Número do edital "30/2026": ano mais novo primeiro, depois o número. */
export function compararEditais(a: unknown, b: unknown) {
  const partes = (valor: unknown): [number, number] => {
    const [numero, ano] = texto(valor).split("/");
    return [Number(ano) || 0, Number(numero) || 0];
  };
  const [anoA, numA] = partes(a);
  const [anoB, numB] = partes(b);
  return anoB - anoA || numB - numA || porTexto(texto(a), texto(b));
}

export function opcoesDosFiltros(
  recursos: readonly RecursoDoPainel[],
  origens: readonly OrigemDoRecurso[] = ORIGENS_PADRAO,
) {
  const editais = new Map<string, string>();
  for (const r of recursos) {
    editais.set(String(r.edital_id), `${r.edital} · ${r.unidade || ""}`.trim());
  }
  return {
    editais: [...editais]
      .sort((a, b) => compararEditais(a[1], b[1]))
      .map(([valor, rotulo]) => ({ valor, rotulo })),
    origens: origens
      .filter((o) => o.ativo || recursos.some((r) => r.origem === o.id))
      .map((o) => ({ valor: o.id, rotulo: o.rotulo })),
    analistas: [...new Set(recursos.map(nomeDoAnalista))]
      .sort(porTexto)
      .map((nome) => ({ valor: nome, rotulo: nome })),
    situacoes: [
      ...SITUACOES.map((s) => ({ valor: s.id, rotulo: s.rotulo })),
      ...Object.entries(GRUPOS_DE_SITUACAO).map(([valor, grupo]) => ({
        valor,
        rotulo: grupo.rotulo,
      })),
    ],
    pendencias: PENDENCIAS.map((p) => ({ valor: p.chave, rotulo: p.titulo })),
  };
}

/* ── Gráficos (valores prontos para o Chart.js do painel) ──────────────── */

export function recursosPorAnalista(
  recursos: readonly RecursoDoPainel[],
  limite = 10,
) {
  const mapa = new Map<
    string,
    { rotulo: string; total: number; pendentes: number; concluidos: number }
  >();
  for (const r of recursos) {
    const nome = nomeDoAnalista(r);
    const item = mapa.get(nome) || {
      rotulo: nome,
      total: 0,
      pendentes: 0,
      concluidos: 0,
    };
    item.total += 1;
    if (r.decidido) item.concluidos += 1;
    else item.pendentes += 1;
    mapa.set(nome, item);
  }
  return [...mapa.values()]
    .sort((a, b) => b.total - a.total || porTexto(a.rotulo, b.rotulo))
    .slice(0, limite);
}

export function recursosPorSituacao(recursos: readonly RecursoDoPainel[]) {
  return SITUACOES.map((s) => ({
    id: s.id,
    rotulo: s.rotulo,
    tom: s.tom,
    valor: recursos.filter((r) => r.situacao === s.id).length,
  }));
}

export function impactoNoResultado(recursos: readonly RecursoDoPainel[]) {
  return IMPACTOS.map(({ teste, ...impacto }) => ({
    ...impacto,
    valor: recursos.filter(teste).length,
  }));
}

export function esteiraDosRecursos(recursos: readonly RecursoDoPainel[]) {
  return [
    {
      id: "cadastrados",
      rotulo: "Recursos cadastrados",
      valor: recursos.length,
    },
    ...ETAPAS.map((etapa) => ({
      id: etapa.id,
      rotulo: etapa.curto,
      valor: recursos.filter((r) => r.etapas[etapa.id]).length,
    })),
  ];
}

/* ── Duplicado ────────────────────────────────────────────────────────── */

/**
 * O recurso em análise do mesmo candidato, edital e origem, se houver (o banco
 * repete a regra e só grava com `permitir_duplicado`).
 */
export function recursoDuplicado(
  recursos: readonly DadosDoRecurso[],
  {
    editalId,
    origem,
    analiseId,
    nomeInformado,
  }: {
    editalId: IdentificadorDoRecurso;
    origem: string;
    analiseId?: IdentificadorDoRecurso | null;
    nomeInformado?: string;
  },
) {
  const nome = normalizarBusca(nomeInformado);
  return (
    recursos.find(
      (r) =>
        String(r.edital_id) === String(editalId) &&
        r.origem === origem &&
        !situacaoDecidida(r.situacao) &&
        (analiseId
          ? String(r.analise_id) === String(analiseId)
          : r.fora_analise && normalizarBusca(r.candidato) === nome),
    ) || null
  );
}

/* ── Formulário ───────────────────────────────────────────────────────── */

export const RASCUNHO_VAZIO: Readonly<RascunhoDoRecurso> = Object.freeze({
  edital_id: "",
  origem: "",
  analise: null,
  fora_analise: false,
  nome_informado: "",
  codigo_informado: "",
  cargo_informado: "",
  vaga_informada: "",
  analista: "",
  processo_sei: "",
  observacao: "",
});

/** Rascunho do formulário de edição a partir do recurso e do detalhe. */
export function rascunhoDoRecurso(
  recurso: DadosDoRecurso,
  detalhe: DetalheParaRascunho = {},
): RascunhoDoRecurso {
  return {
    ...RASCUNHO_VAZIO,
    edital_id: String(recurso.edital_id ?? ""),
    origem: recurso.origem || "",
    analise: recurso.fora_analise ? null : { id: recurso.analise_id },
    fora_analise: Boolean(recurso.fora_analise),
    nome_informado:
      detalhe.nome_informado ??
      (recurso.fora_analise ? recurso.candidato || "" : ""),
    codigo_informado:
      detalhe.codigo_informado ??
      (recurso.fora_analise ? recurso.codigo || "" : ""),
    cargo_informado:
      detalhe.cargo_informado ??
      (recurso.fora_analise ? recurso.cargo || "" : ""),
    vaga_informada:
      detalhe.vaga_informada ??
      (recurso.fora_analise ? recurso.vaga || "" : ""),
    analista: recurso.analista || "",
    processo_sei: recurso.processo_sei || "",
    observacao: detalhe.observacao ?? "",
  };
}

/** Os erros do rascunho, por campo (vazio = pode salvar). */
export function errosDoRascunho(
  rascunho: RascunhoDoRecurso,
  { edicao = false } = {},
) {
  const erros: Partial<Record<keyof RascunhoDoRecurso | "candidato", string>> =
    {};
  if (!edicao && !rascunho.edital_id) erros.edital_id = "Escolha o edital.";
  if (!rascunho.origem) erros.origem = "Escolha a origem do recurso.";
  if (!edicao && !rascunho.fora_analise && !rascunho.analise?.id)
    erros.candidato = "Escolha o candidato na lista das análises.";
  if (rascunho.fora_analise) {
    const nome = texto(rascunho.nome_informado);
    if (nome.length < 3 || nome.length > 200)
      erros.nome_informado =
        "Informe o nome do candidato (3 a 200 caracteres).";
  }
  if (texto(rascunho.observacao).length > 2000)
    erros.observacao = "A observação passa de 2.000 caracteres.";
  return erros;
}

/**
 * O `p_dados` de `salvar_recurso_candidato`. Sem `mudou_classificacao`:
 * desde 20261005130000 a marca é automática (aprovar o ajuste da pontuação
 * que muda a posição a marca; cancelar desmarca) e o banco recusa mudá-la.
 */
export function dadosParaSalvar(
  rascunho: RascunhoDoRecurso,
  {
    id = null,
    revisao = null,
    permitirDuplicado = false,
  }: {
    id?: IdentificadorDoRecurso | null;
    revisao?: number | null;
    permitirDuplicado?: boolean;
  } = {},
) {
  const comuns = {
    origem: rascunho.origem,
    analista: texto(rascunho.analista),
    processo_sei: texto(rascunho.processo_sei),
    observacao: texto(rascunho.observacao),
  };
  const informados = rascunho.fora_analise
    ? {
        nome_informado: texto(rascunho.nome_informado),
        codigo_informado: texto(rascunho.codigo_informado),
        cargo_informado: texto(rascunho.cargo_informado),
        vaga_informada: texto(rascunho.vaga_informada),
      }
    : {};
  if (id) return { id, revisao, ...comuns, ...informados };
  return {
    edital_id: rascunho.edital_id,
    fora_analise: Boolean(rascunho.fora_analise),
    analise_id: rascunho.fora_analise ? null : rascunho.analise?.id || null,
    permitir_duplicado: Boolean(permitirDuplicado),
    ...comuns,
    ...informados,
  };
}

/* ── CSV ──────────────────────────────────────────────────────────────── */

const simNao = (valor: unknown) => (valor ? "Sim" : "Não");
/* Data pura (AAAA-MM-DD, do cronograma) fica como está; instante vira o dia em Brasília. */
const dataBR = (valor: DataDoRecurso | null | undefined) => {
  const texto = String(valor ?? "");
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? texto
    : valor
      ? diaEmBrasilia(valor)
      : "";
  return dia ? dia.split("-").reverse().join("/") : "";
};
const numeroBR = (valor: unknown) =>
  valor === null || valor === undefined || valor === ""
    ? ""
    : String(valor).replace(".", ",");

type ColunaDoCsv = readonly [
  string,
  (recurso: RecursoDoPainel, origens: readonly OrigemDoRecurso[]) => unknown,
];
export const COLUNAS_DO_CSV: readonly ColunaDoCsv[] = Object.freeze([
  ["Nº", (r) => r.nu],
  ["Edital", (r) => r.edital],
  ["Unidade", (r) => r.unidade],
  ["Origem", (r, origens) => rotuloDaOrigem(r.origem, origens)],
  ["Código do candidato", (r) => r.codigo],
  ["Candidato", (r) => r.candidato],
  ["Fora das análises", (r) => simNao(r.fora_analise)],
  ["Cargo", (r) => r.cargo],
  ["Vaga", (r) => r.vaga],
  ["Analista", (r) => r.analista],
  ["Situação", (r) => rotuloDaSituacao(r.situacao)],
  ["Decidido em", (r) => dataBR(r.decisao_em)],
  ...ETAPAS.map((etapa): ColunaDoCsv => [
    etapa.rotulo,
    (r) => dataBR(r[etapa.campo]),
  ]),
  ["Nº processo SEI", (r) => r.processo_sei],
  ["Nota no cadastro", (r) => numeroBR(r.nota_anterior)],
  ["Nota atual", (r) => numeroBR(r.nota_atual)],
  ["Mudou a nota", (r) => simNao(r.mudouNota)],
  ["Mudou a classificação", (r) => simNao(r.mudouClassificacao)],
  ["Prazo de resposta", (r) => dataBR(r.prazo?.data)],
  ["Atrasado", (r) => simNao(r.atrasado)],
  ["Dias em aberto", (r) => r.diasEmAberto ?? ""],
  ["Cadastrado em", (r) => dataBR(r.criado_em)],
]);

/** CSV com `;` (Excel pt-BR), BOM e células protegidas contra fórmula. */
export function csvDosRecursos(
  recursos: readonly RecursoDoPainel[],
  origens: readonly OrigemDoRecurso[] = ORIGENS_PADRAO,
) {
  const celula = (valor: unknown) => {
    const seguro = sanitizeCsvCell(valor ?? "");
    return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  const linhas = [
    COLUNAS_DO_CSV.map(([titulo]) => celula(titulo)).join(";"),
    ...recursos.map((r) =>
      COLUNAS_DO_CSV.map(([, valor]) => celula(valor(r, origens))).join(";"),
    ),
  ];
  return `\uFEFF${linhas.join("\r\n")}\r\n`;
}

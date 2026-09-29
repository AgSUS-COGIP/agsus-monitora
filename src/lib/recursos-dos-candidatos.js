/*
  A aba Recursos sem DOM: situações, etapas, o que se calcula de cada recurso
  (nota mudou, dias em aberto, prazo, atraso), os indicadores, as pendências
  prioritárias, os filtros, os gráficos, o CSV e a validação do formulário.

  O recurso chega de `get_recursos_da_area` (supabase/migrations/
  20260929120000_recursos.sql) já com o candidato, a vaga, a nota e o resultado
  da análise curricular ligada; o prazo sai do cronograma do edital por
  `prazo-do-recurso.js`. O desenho é de `src/componentes/recursos/`.

  Substitui o painel de recursos do Apps Script: mesmas colunas (edital, cargo,
  vaga, origem, analista, código e nome do candidato, situação e as etapas), os
  mesmos indicadores e pendências — agora com prazo, dias em aberto e "a nota
  mudou" calculados, sem digitar.
*/
import { sanitizeCsvCell } from "./csv-security.js";
import { cronogramasPorEdital, prazoDoRecurso } from "./prazo-do-recurso.js";

export const SITUACOES = Object.freeze([
  Object.freeze({ id: "EM_ANALISE", rotulo: "Em análise", tom: "warning" }),
  Object.freeze({ id: "DEFERIDO", rotulo: "Deferido", tom: "success" }),
  Object.freeze({ id: "INDEFERIDO", rotulo: "Indeferido", tom: "danger" }),
  Object.freeze({
    id: "PARCIALMENTE_INDEFERIDO",
    rotulo: "Parcialmente indeferido",
    tom: "info",
  }),
]);

/* As etapas da esteira, na ordem do trabalho. `campo` é a data que o banco devolve. */
export const ETAPAS = Object.freeze([
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
const texto = (valor) => String(valor ?? "").trim();
const DIA = 24 * 60 * 60 * 1000;

export function normalizarBusca(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const rotuloDaSituacao = (id) =>
  SITUACOES.find((s) => s.id === id)?.rotulo || texto(id) || "Em análise";
export const tomDaSituacao = (id) =>
  SITUACOES.find((s) => s.id === id)?.tom || "neutral";
export const rotuloDaOrigem = (id, origens = ORIGENS_PADRAO) =>
  origens.find((o) => o.id === id)?.rotulo || texto(id) || "Sem origem";

/* Data do dia (AAAA-MM-DD) no fuso de quem usa: prazo é data, não instante. */
export function diaLocal(data = new Date()) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/* Dias inteiros entre duas datas AAAA-MM-DD (b − a). */
const emUtc = (dia) => {
  const [ano, mes, d] = dia.split("-").map(Number);
  return Date.UTC(ano, mes - 1, d);
};

export function diasEntre(a, b) {
  if (!a || !b) return null;
  return Math.round((emUtc(b) - emUtc(a)) / DIA);
}

const nota = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? null
    : Number.isFinite(Number(valor))
      ? Number(valor)
      : null;

/*
  A nota mudou quando a nota atual da análise é outra que a guardada no dia do
  cadastro. Fora das análises (sem nota), não há como saber: não mudou.
*/
export function notaMudou(recurso) {
  const antes = nota(recurso?.nota_anterior);
  const agora = nota(recurso?.nota_atual);
  if (antes === null || agora === null) return false;
  return Math.abs(antes - agora) > 1e-9;
}

/**
 * O recurso com o que se calcula dele. `cronogramas` é o mapa edital →
 * etapas (`cronogramasPorEdital`); `hoje`, a data AAAA-MM-DD.
 */
export function enriquecerRecurso(recurso, { cronogramas, hoje }) {
  const etapas = Object.fromEntries(
    ETAPAS.map((etapa) => [etapa.id, Boolean(recurso[etapa.campo])]),
  );
  const decidido = texto(recurso.situacao || "EM_ANALISE") !== "EM_ANALISE";
  const mudouNota = notaMudou(recurso);
  const mudouClassificacao = Boolean(recurso.mudou_classificacao);
  const prazo = prazoDoRecurso(
    cronogramas?.get(String(recurso.edital_id)) || [],
    recurso.origem,
  );
  const inicio = diaLocal(recurso.criado_em);
  const fim =
    decidido && recurso.decisao_em ? diaLocal(recurso.decisao_em) : hoje;
  const diasEmAberto = inicio ? Math.max(0, diasEntre(inicio, fim) ?? 0) : null;
  const diasParaPrazo = prazo.data ? diasEntre(hoje, prazo.data) : null;
  const semResposta = !etapas.resposta_candidato;
  return {
    ...recurso,
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
    etapasFeitas: ETAPAS.filter((etapa) => etapas[etapa.id]).length,
  };
}

export function enriquecerRecursos(dados, hoje = diaLocal()) {
  const cronogramas = cronogramasPorEdital(dados?.cronogramas);
  return (Array.isArray(dados?.recursos) ? dados.recursos : []).map((r) =>
    enriquecerRecurso(r, { cronogramas, hoje }),
  );
}

/* Pendências: a chave filtra a tabela; o teste diz quem entra. */
export const PENDENCIAS = Object.freeze([
  Object.freeze({
    chave: "prazo_vencido",
    titulo: "Prazo de resposta vencido",
    subtitulo:
      "Sem resposta ao candidato e com o prazo do cronograma já passado.",
    severidade: "alta",
    teste: (r) => r.atrasado,
  }),
  Object.freeze({
    chave: "sem_analista",
    titulo: "Sem analista responsável",
    subtitulo: "Recursos que ainda precisam ser distribuídos.",
    severidade: "alta",
    teste: (r) => !r.analista,
  }),
  Object.freeze({
    chave: "sem_sei",
    titulo: "Sem processo SEI",
    subtitulo: "Recursos sem processo SEI criado.",
    severidade: "alta",
    teste: (r) => !r.etapas.processo_sei,
  }),
  Object.freeze({
    chave: "sem_upload_sei",
    titulo: "Sem documentação no SEI",
    subtitulo: "Processo criado, mas a documentação ainda não foi juntada.",
    severidade: "media",
    teste: (r) => r.etapas.processo_sei && !r.etapas.upload_sei,
  }),
  Object.freeze({
    chave: "sem_resposta",
    titulo: "Decididos sem resposta ao candidato",
    subtitulo: "A situação já foi decidida, mas a resposta não foi enviada.",
    severidade: "alta",
    teste: (r) => r.decidido && !r.etapas.resposta_candidato,
  }),
  Object.freeze({
    chave: "mudou_resultado",
    titulo: "Mudança de nota ou classificação",
    subtitulo: "Casos sensíveis para conferir no resultado final.",
    severidade: "media",
    teste: (r) => r.mudouResultado,
  }),
  Object.freeze({
    chave: "sem_prazo",
    titulo: "Prazo não encontrado no cronograma",
    subtitulo:
      "O cronograma do edital não traz o prazo de recurso desta origem.",
    severidade: "baixa",
    teste: (r) => !r.prazo.data,
  }),
  Object.freeze({
    chave: "fora_analise",
    titulo: "Candidato fora das análises",
    subtitulo: "Cadastrado com o nome digitado; confira os dados.",
    severidade: "baixa",
    teste: (r) => r.fora_analise,
  }),
]);

/** As pendências com ocorrência, na ordem de prioridade. */
export function pendenciasPrioritarias(recursos) {
  return PENDENCIAS.map(({ teste, ...pendencia }) => ({
    ...pendencia,
    valor: recursos.filter(teste).length,
  })).filter((pendencia) => pendencia.valor > 0);
}

export function calcularIndicadores(recursos) {
  const total = recursos.length;
  const concluidos = recursos.filter((r) => r.decidido).length;
  return {
    total,
    pendentes: total - concluidos,
    concluidos,
    semSei: recursos.filter((r) => !r.etapas.processo_sei).length,
    semResposta: recursos.filter((r) => !r.etapas.resposta_candidato).length,
    mudouResultado: recursos.filter((r) => r.mudouResultado).length,
    atrasados: recursos.filter((r) => r.atrasado).length,
    taxaConclusao: total ? Math.round((concluidos / total) * 100) : 0,
  };
}

/* ── Filtros ─────────────────────────────────────────────────────────── */

export const FILTROS_VAZIOS = Object.freeze({
  edital: "",
  origem: "",
  analista: "",
  situacao: "",
  pendencia: "",
  busca: "",
});

export const IMPACTOS = Object.freeze([
  Object.freeze({
    id: "nota",
    rotulo: "Mudou a nota",
    teste: (r) => r.mudouNota,
  }),
  Object.freeze({
    id: "classificacao",
    rotulo: "Mudou a classificação",
    teste: (r) => r.mudouClassificacao,
  }),
  Object.freeze({
    id: "sem",
    rotulo: "Sem alteração",
    teste: (r) => !r.mudouResultado,
  }),
]);

const nomeDoAnalista = (r) => r.analista || SEM_ANALISTA;

export function filtrarRecursos(recursos, filtros = FILTROS_VAZIOS) {
  const busca = normalizarBusca(filtros.busca);
  const pendencia = PENDENCIAS.find((p) => p.chave === filtros.pendencia);
  return recursos.filter((r) => {
    if (filtros.edital && String(r.edital_id) !== filtros.edital) return false;
    if (filtros.origem && r.origem !== filtros.origem) return false;
    if (filtros.analista && nomeDoAnalista(r) !== filtros.analista)
      return false;
    if (filtros.situacao && r.situacao !== filtros.situacao) return false;
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

const porTexto = (a, b) =>
  a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

/* Número do edital "30/2026": ano mais novo primeiro, depois o número. */
export function compararEditais(a, b) {
  const partes = (valor) => {
    const [numero, ano] = texto(valor).split("/");
    return [Number(ano) || 0, Number(numero) || 0];
  };
  const [anoA, numA] = partes(a);
  const [anoB, numB] = partes(b);
  return anoB - anoA || numB - numA || porTexto(texto(a), texto(b));
}

export function opcoesDosFiltros(recursos, origens = ORIGENS_PADRAO) {
  const editais = new Map();
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
    situacoes: SITUACOES.map((s) => ({ valor: s.id, rotulo: s.rotulo })),
    pendencias: PENDENCIAS.map((p) => ({ valor: p.chave, rotulo: p.titulo })),
  };
}

/* ── Gráficos (barras em HTML: valores prontos para desenhar) ──────────── */

export function recursosPorAnalista(recursos, limite = 10) {
  const mapa = new Map();
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

export function recursosPorSituacao(recursos) {
  return SITUACOES.map((s) => ({
    id: s.id,
    rotulo: s.rotulo,
    tom: s.tom,
    valor: recursos.filter((r) => r.situacao === s.id).length,
  }));
}

export function impactoNoResultado(recursos) {
  return IMPACTOS.map(({ teste, ...impacto }) => ({
    ...impacto,
    valor: recursos.filter(teste).length,
  }));
}

export function esteiraDosRecursos(recursos) {
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
  recursos,
  { editalId, origem, analiseId, nomeInformado },
) {
  const nome = normalizarBusca(nomeInformado);
  return (
    recursos.find(
      (r) =>
        String(r.edital_id) === String(editalId) &&
        r.origem === origem &&
        (r.situacao || "EM_ANALISE") === "EM_ANALISE" &&
        (analiseId
          ? String(r.analise_id) === String(analiseId)
          : r.fora_analise && normalizarBusca(r.candidato) === nome),
    ) || null
  );
}

/* ── Formulário ───────────────────────────────────────────────────────── */

export const RASCUNHO_VAZIO = Object.freeze({
  edital_id: "",
  origem: "",
  analise: null,
  fora_analise: false,
  nome_informado: "",
  codigo_informado: "",
  cargo_informado: "",
  vaga_informada: "",
  analista: "",
  situacao: "EM_ANALISE",
  processo_sei: "",
  mudou_classificacao: false,
  observacao: "",
});

/** Rascunho do formulário de edição a partir do recurso e do detalhe. */
export function rascunhoDoRecurso(recurso, detalhe = {}) {
  return {
    ...RASCUNHO_VAZIO,
    edital_id: String(recurso.edital_id ?? ""),
    origem: recurso.origem || "",
    analise: recurso.fora_analise ? null : { id: recurso.analise_id },
    fora_analise: Boolean(recurso.fora_analise),
    nome_informado:
      detalhe.nome_informado ?? (recurso.fora_analise ? recurso.candidato : ""),
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
    situacao: recurso.situacao || "EM_ANALISE",
    processo_sei: recurso.processo_sei || "",
    mudou_classificacao: Boolean(recurso.mudou_classificacao),
    observacao: detalhe.observacao ?? "",
  };
}

/** Os erros do rascunho, por campo (vazio = pode salvar). */
export function errosDoRascunho(rascunho, { edicao = false } = {}) {
  const erros = {};
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

/** O `p_dados` de `salvar_recurso_candidato`. */
export function dadosParaSalvar(
  rascunho,
  { id = null, revisao = null, permitirDuplicado = false } = {},
) {
  const comuns = {
    origem: rascunho.origem,
    analista: texto(rascunho.analista),
    situacao: rascunho.situacao || "EM_ANALISE",
    processo_sei: texto(rascunho.processo_sei),
    mudou_classificacao: Boolean(rascunho.mudou_classificacao),
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

const simNao = (valor) => (valor ? "Sim" : "Não");
/* Data pura (AAAA-MM-DD, do cronograma) fica como está; instante vira o dia local. */
const dataBR = (valor) => {
  const texto = String(valor ?? "");
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? texto
    : valor
      ? diaLocal(valor)
      : "";
  return dia ? dia.split("-").reverse().join("/") : "";
};
const numeroBR = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? ""
    : String(valor).replace(".", ",");

export const COLUNAS_DO_CSV = Object.freeze([
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
  ...ETAPAS.map((etapa) => [etapa.rotulo, (r) => dataBR(r[etapa.campo])]),
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
export function csvDosRecursos(recursos, origens = ORIGENS_PADRAO) {
  const celula = (valor) => {
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

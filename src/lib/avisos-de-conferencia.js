/*
  Avisos de conferência, sem React e sem banco: o que chega de
  `listar_avisos_conferencia` (20261005210000_conferencias_de_consistencia.sql)
  vira a lista da tela — título de cada conferência, tom da gravidade, onde
  (edital, área ou vaga), contagem do selo de cada módulo e a validação do
  motivo ao ignorar.

  Os avisos são gravados pelo job Python scripts/conferencias/ (todo dia às 6h
  e pelo "Rodar agora"). O catálogo (código → módulo, gravidade, título) é o
  mesmo do job: tests/fixtures/conferencias/catalogo.json é o caso dourado que
  o vitest e o pytest conferem.

  Os casos de cada aviso (todos, não só os 20 exemplos) vêm de
  `listar_casos_aviso_conferencia` (20261007120000): quem é (código, nome),
  onde (edital, vaga, responsável), o motivo (datas, notas) e o CSV.
*/
import { sanitizeCsvCell } from "./csv-security.js";

export const CONFERENCIAS = Object.freeze({
  ANALISE_APROVADA_ABAIXO_DO_CORTE: Object.freeze({
    modulo: "analises",
    gravidade: "CRITICA",
    titulo: "Aprovada com nota abaixo da mínima",
  }),
  ANALISE_NOTA_DIFERENTE_DA_SOMA: Object.freeze({
    modulo: "analises",
    gravidade: "ATENCAO",
    titulo: "Nota final diferente da soma das parciais",
  }),
  ANALISE_EXPERIENCIA_ACIMA_DO_TETO: Object.freeze({
    modulo: "analises",
    gravidade: "ATENCAO",
    titulo: "Experiência acima do teto da regra",
  }),
  ANALISE_DATA_INVALIDA: Object.freeze({
    modulo: "analises",
    gravidade: "ATENCAO",
    titulo: "Data da análise no futuro ou antes da inscrição",
  }),
  ANALISE_EM_DOIS_EDITAIS: Object.freeze({
    modulo: "analises",
    gravidade: "INFORMATIVO",
    titulo: "Candidato analisado em dois editais ativos",
  }),
  ENTREVISTA_SEM_NOTA_APOS_DATA: Object.freeze({
    modulo: "entrevistas",
    gravidade: "ATENCAO",
    titulo: "Convocado sem nota depois da data da entrevista",
  }),
  ENTREVISTA_NOTA_FORA_DA_ESCALA: Object.freeze({
    modulo: "entrevistas",
    gravidade: "CRITICA",
    titulo: "Nota fora da escala do roteiro",
  }),
  ENTREVISTA_FORA_DA_CONVOCACAO: Object.freeze({
    modulo: "entrevistas",
    gravidade: "CRITICA",
    titulo: "Convocado fora da lista de convocação vigente",
  }),
  ENTREVISTA_HORARIO_DUPLICADO: Object.freeze({
    modulo: "entrevistas",
    gravidade: "ATENCAO",
    titulo: "Dois horários para o mesmo candidato",
  }),
  CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA: Object.freeze({
    modulo: "classificacao",
    gravidade: "CRITICA",
    titulo: "Lista final gerada antes da última mudança nas análises",
  }),
  CLASSIFICACAO_EMPATE_PENDENTE: Object.freeze({
    modulo: "classificacao",
    gravidade: "ATENCAO",
    titulo: "Empate sem desempate registrado",
  }),
  CLASSIFICACAO_VAGA_SEM_QUADRO: Object.freeze({
    modulo: "classificacao",
    gravidade: "ATENCAO",
    titulo: "Vaga sem linha no quadro de vagas",
  }),
  CLASSIFICACAO_AJUSTE_APOS_LISTA: Object.freeze({
    modulo: "classificacao",
    gravidade: "ATENCAO",
    titulo: "Ajuste de recurso aprovado depois da última lista",
  }),
  APROVADOS_CONTRATADO_DUPLICADO: Object.freeze({
    modulo: "aprovados",
    gravidade: "CRITICA",
    titulo: "Contratado em duas vagas",
  }),
  APROVADOS_CONVOCADO_SEM_DESFECHO: Object.freeze({
    modulo: "aprovados",
    gravidade: "ATENCAO",
    titulo: "Convocado há muitos dias sem desfecho",
  }),
  APROVADOS_PENDENCIA_DA_PUBLICACAO: Object.freeze({
    modulo: "aprovados",
    gravidade: "ATENCAO",
    titulo: "Pendência da publicação sem revisão",
  }),
  CARGA_VARIACAO_BRUSCA: Object.freeze({
    modulo: "cargas",
    gravidade: "ATENCAO",
    titulo: "Variação brusca de candidatos na Empregare",
  }),
});

export const MODULOS_DOS_AVISOS = Object.freeze([
  Object.freeze({ valor: "analises", rotulo: "Análises" }),
  Object.freeze({ valor: "entrevistas", rotulo: "Entrevistas" }),
  Object.freeze({ valor: "classificacao", rotulo: "Classificação" }),
  Object.freeze({ valor: "aprovados", rotulo: "Aprovados" }),
  Object.freeze({ valor: "cargas", rotulo: "Cargas" }),
]);

export const GRAVIDADES = Object.freeze({
  CRITICA: Object.freeze({ rotulo: "Crítico", tom: "perigo", ordem: 0 }),
  ATENCAO: Object.freeze({ rotulo: "Atenção", tom: "aviso", ordem: 1 }),
  INFORMATIVO: Object.freeze({ rotulo: "Informativo", tom: "info", ordem: 2 }),
});

export const LIMITES_DO_MOTIVO = Object.freeze({ minimo: 10, maximo: 500 });

const NOMES_DAS_AREAS = Object.freeze({
  "saude-indigena": "Saúde Indígena",
  sede: "SEDE",
  projetos: "Projetos",
});

const texto = (valor) => String(valor ?? "").trim();

const data = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Título da conferência (o código, se for uma que a tela ainda não conhece). */
export const tituloDaConferencia = (codigo) =>
  CONFERENCIAS[codigo]?.titulo || texto(codigo);

/** "Edital 101/2026", "Saúde Indígena" ou "Vaga 177979". */
export function ondeDoAviso(aviso) {
  const [tipo, ...resto] = texto(aviso?.escopo).split(":");
  const id = resto.join(":");
  if (tipo === "edital")
    return aviso?.edital ? `Edital ${texto(aviso.edital)}` : "Edital";
  if (tipo === "vaga") return `Vaga ${id}`;
  return NOMES_DAS_AREAS[aviso?.area] || NOMES_DAS_AREAS[id] || "Sem área";
}

function normalizarAviso(bruto) {
  const gravidade = GRAVIDADES[bruto?.gravidade] ? bruto.gravidade : "ATENCAO";
  return {
    id: texto(bruto?.id),
    conferencia: texto(bruto?.conferencia),
    titulo: tituloDaConferencia(bruto?.conferencia),
    escopo: texto(bruto?.escopo),
    gravidade,
    tom: GRAVIDADES[gravidade].tom,
    rotuloDaGravidade: GRAVIDADES[gravidade].rotulo,
    modulo: texto(bruto?.modulo),
    area: texto(bruto?.area) || null,
    editalId: texto(bruto?.edital_id) || null,
    edital: texto(bruto?.edital) || null,
    onde: ondeDoAviso(bruto),
    quantidade: Math.max(0, Math.round(Number(bruto?.quantidade) || 0)),
    exemplos: (Array.isArray(bruto?.exemplos) ? bruto.exemplos : [])
      .map(texto)
      .filter(Boolean),
    resumo: texto(bruto?.resumo),
    situacao: bruto?.situacao === "IGNORADO" ? "IGNORADO" : "ABERTO",
    primeiraVez: data(bruto?.primeira_vez),
    ultimaVez: data(bruto?.ultima_vez),
    ignoradoEm: data(bruto?.ignorado_em),
    motivo: texto(bruto?.motivo) || null,
    podeIgnorar: bruto?.pode_ignorar === true,
  };
}

/** O payload de `listar_avisos_conferencia` em abertos (por gravidade) e ignorados. */
export function normalizarAvisos(dados) {
  const avisos = (Array.isArray(dados?.avisos) ? dados.avisos : []).map(
    normalizarAviso,
  );
  const porGravidade = (a, b) =>
    GRAVIDADES[a.gravidade].ordem - GRAVIDADES[b.gravidade].ordem ||
    (a.primeiraVez?.getTime() ?? 0) - (b.primeiraVez?.getTime() ?? 0);
  const ultima = dados?.ultima_execucao;
  return {
    geradoEm: data(dados?.gerado_em),
    ultimaExecucao: ultima
      ? {
          inicio: data(ultima.inicio),
          fim: data(ultima.fim),
          situacao: texto(ultima.situacao),
        }
      : null,
    abertos: avisos.filter((a) => a.situacao === "ABERTO").sort(porGravidade),
    ignorados: avisos.filter((a) => a.situacao === "IGNORADO"),
  };
}

/** Avisos abertos por módulo (o selo de cada tela). */
export function contagemPorModulo(lista) {
  const contagem = Object.fromEntries(
    MODULOS_DOS_AVISOS.map((m) => [m.valor, 0]),
  );
  for (const aviso of lista?.abertos || [])
    if (aviso.modulo in contagem) contagem[aviso.modulo] += 1;
  return contagem;
}

/** Só os avisos de um módulo ("todos" = todos). */
export function filtrarPorModulo(lista, modulo) {
  if (!lista) return lista;
  if (!modulo || modulo === "todos") return lista;
  return {
    ...lista,
    abertos: lista.abertos.filter((a) => a.modulo === modulo),
    ignorados: lista.ignorados.filter((a) => a.modulo === modulo),
  };
}

/** Tom do selo de um módulo: o do aviso mais grave aberto. */
export function tomDoSelo(abertos) {
  const mais = [...(abertos || [])].sort(
    (a, b) => GRAVIDADES[a.gravidade].ordem - GRAVIDADES[b.gravidade].ordem,
  )[0];
  return mais ? mais.tom : null;
}

/** Erro do motivo ao ignorar, ou "" quando está bom. */
export function erroDoMotivo(motivo) {
  const t = texto(motivo);
  if (t.length < LIMITES_DO_MOTIVO.minimo)
    return `Escreva o motivo (pelo menos ${LIMITES_DO_MOTIVO.minimo} caracteres).`;
  if (t.length > LIMITES_DO_MOTIVO.maximo)
    return `O motivo passa de ${LIMITES_DO_MOTIVO.maximo} caracteres.`;
  return "";
}

/** "dd/mm/aaaa"; "—" sem data. */
export function diaDoAviso(valor) {
  if (!(valor instanceof Date)) return "—";
  const dois = (n) => String(n).padStart(2, "0");
  return `${dois(valor.getDate())}/${dois(valor.getMonth() + 1)}/${valor.getFullYear()}`;
}

/* ── Casos de um aviso (listar_casos_aviso_conferencia, 20261007120000) ── */

/** Casos por página na gaveta; o CSV lê de 1000 em 1000. */
export const CASOS_POR_PAGINA = 50;
export const CASOS_POR_PAGINA_DO_CSV = 1000;

/** "dd/mm/aaaa" de "aaaa-mm-dd…" (sem fuso: a data é do dia); "" se não der. */
export function diaDoCaso(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto(valor));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

const numeroDoCaso = (valor) => {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = Number(valor);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    : "—";
};

/** "1777 · Enfermeiro" (o que houver). */
const vagaDe = (codigo, nome) =>
  [texto(codigo), texto(nome)].filter(Boolean).join(" · ");

function normalizarAnaliseDoCaso(bruto) {
  return {
    id: texto(bruto?.id) || null,
    edital: texto(bruto?.edital),
    vaga: vagaDe(bruto?.codigo_vaga, bruto?.nome_vaga),
    status: texto(bruto?.status),
    responsavel: texto(bruto?.responsavel),
    dataAnalise: texto(bruto?.data_analise) || null,
  };
}

/**
 * O que motivou o aviso, em uma linha curta ("Análise em 01/09/2026, antes
 * da inscrição em 10/09/2026"). "" quando o caso não traz o dado.
 */
export function motivoDoCaso(conferencia, detalhe = {}, caso = {}) {
  const d = detalhe || {};
  switch (conferencia) {
    case "ANALISE_DATA_INVALIDA": {
      const analise = diaDoCaso(d.data_analise || caso.dataAnalise);
      if (!analise) return "";
      if (d.motivo === "futuro") return `Análise em ${analise}, data futura`;
      const inscricao = diaDoCaso(d.inscricao);
      return inscricao
        ? `Análise em ${analise}, antes da inscrição em ${inscricao}`
        : `Análise em ${analise}`;
    }
    case "ANALISE_APROVADA_ABAIXO_DO_CORTE":
      return `Nota ${numeroDoCaso(d.nota)} · mínima ${numeroDoCaso(d.corte)}`;
    case "ANALISE_NOTA_DIFERENTE_DA_SOMA":
      return `Nota ${numeroDoCaso(d.nota)} · soma das parciais ${numeroDoCaso(d.soma)}`;
    case "ANALISE_EXPERIENCIA_ACIMA_DO_TETO":
      return `Experiência ${numeroDoCaso(d.experiencia)} · teto ${numeroDoCaso(d.teto)}`;
    case "ANALISE_EM_DOIS_EDITAIS": {
      const n = Number(d.editais) || caso.analises?.length || 0;
      return n > 1 ? `Em ${n} editais ativos` : "Em mais de um edital ativo";
    }
    case "ENTREVISTA_SEM_NOTA_APOS_DATA":
      return d.data_entrevista
        ? `Entrevista em ${diaDoCaso(d.data_entrevista)}, sem nota`
        : "";
    case "ENTREVISTA_NOTA_FORA_DA_ESCALA":
      return d.maxima !== undefined && d.maxima !== null
        ? `Nota ${numeroDoCaso(d.nota)} · máxima ${numeroDoCaso(d.maxima)}`
        : `Nota ${numeroDoCaso(d.nota)}`;
    case "ENTREVISTA_HORARIO_DUPLICADO":
      return Number(d.horarios) > 1 ? `${d.horarios} horários` : "";
    default:
      return "";
  }
}

/** Um caso de `listar_casos_aviso_conferencia`, pronto para a tela e o CSV. */
export function normalizarCaso(bruto) {
  const conferencia = texto(bruto?.conferencia);
  const detalhe =
    bruto?.detalhe && typeof bruto.detalhe === "object" ? bruto.detalhe : {};
  const caso = {
    avisoId: texto(bruto?.aviso_id),
    conferencia,
    titulo: tituloDaConferencia(conferencia),
    ordem: Math.max(0, Math.round(Number(bruto?.ordem) || 0)),
    analiseId: texto(bruto?.analise_id) || null,
    codigo: texto(bruto?.codigo),
    nome: texto(bruto?.nome),
    edital: texto(bruto?.edital),
    vaga: vagaDe(bruto?.codigo_vaga, bruto?.nome_vaga),
    responsavel: texto(bruto?.responsavel),
    status: texto(bruto?.status),
    dataAnalise: texto(bruto?.data_analise) || null,
    referencia: texto(bruto?.referencia),
    detalhe,
    analises: (Array.isArray(bruto?.analises) ? bruto.analises : []).map(
      normalizarAnaliseDoCaso,
    ),
    foraDoAcesso: Math.max(0, Math.round(Number(bruto?.fora_do_acesso) || 0)),
  };
  caso.chave = `${caso.avisoId}:${caso.ordem}`;
  caso.motivo = motivoDoCaso(conferencia, detalhe, caso);
  return caso;
}

/** A página de `listar_casos_aviso_conferencia`: `{ total, casos }`. */
export function normalizarCasos(dados) {
  const casos = (Array.isArray(dados?.casos) ? dados.casos : []).map(
    normalizarCaso,
  );
  return {
    total: Math.max(casos.length, Math.round(Number(dados?.total) || 0)),
    casos,
  };
}

/** Junta a página nova às anteriores, sem repetir caso. */
export function juntarPaginasDeCasos(anteriores, nova) {
  const vistos = new Set((anteriores || []).map((c) => c.chave));
  return [
    ...(anteriores || []),
    ...(nova || []).filter((c) => !vistos.has(c.chave)),
  ];
}

/** Quantos casos ainda faltam carregar. */
export const casosRestantes = (carregados, total) =>
  Math.max(0, (Number(total) || 0) - (carregados?.length || 0));

/** O texto de busca enviado ao banco (até 80 caracteres; vazio = sem busca). */
export const termoDeBusca = (valor) =>
  texto(valor).replace(/\s+/g, " ").slice(0, 80);

/** Quem é o caso, em uma linha: "177979 · Nome" ou a referência. */
export function quemDoCaso(caso) {
  const partes = [caso?.codigo, caso?.nome].map(texto).filter(Boolean);
  if (partes.length) return partes.join(" · ");
  return caso?.referencia
    ? `Referência ${caso.referencia}`
    : "Sem identificação";
}

/** Edital, vaga e responsável do caso, em uma linha (o que houver). */
export function ondeDoCaso(caso) {
  return [
    caso?.edital,
    caso?.vaga,
    caso?.responsavel ? `Resp. ${caso.responsavel}` : "",
  ]
    .map(texto)
    .filter(Boolean)
    .join(" · ");
}

/** O caso abre o Painel das análises? (aviso das análises, com análise para mostrar). */
export const casoAbreAnalise = (caso, modulo) =>
  modulo === "analises" &&
  Boolean(caso?.analiseId || caso?.analises?.some((a) => a.id));

/**
 * O pedido de filtro (src/app/pedido-de-filtro.js) que leva o Painel das
 * análises ao caso: a busca pelo nome e a análise a abrir na gaveta.
 */
export function filtroDoCaso(caso) {
  const analise =
    caso?.analiseId || caso?.analises?.find((a) => a.id)?.id || null;
  return { busca: texto(caso?.nome), analise };
}

const COLUNAS_DO_CSV_DE_CASOS = Object.freeze([
  ["Aviso", (c) => c.titulo],
  ["Código do candidato", (c) => c.codigo],
  ["Nome", (c) => c.nome],
  ["Edital", (c) => c.edital],
  ["Vaga", (c) => c.vaga],
  ["Responsável pela análise", (c) => c.responsavel],
  ["Situação", (c) => c.status],
  ["Data da análise", (c) => diaDoCaso(c.dataAnalise)],
  ["Motivo", (c) => c.motivo],
  [
    "Análises do candidato",
    (c) =>
      c.analises
        .map((a) => [a.edital, a.vaga, a.status].filter(Boolean).join(" · "))
        .join(" | "),
  ],
  ["Referência", (c) => c.referencia],
]);

/** CSV (";") dos casos, com cada célula protegida contra fórmula. */
export function csvDosCasos(casos) {
  const celula = (valor) =>
    sanitizeCsvCell(
      String(valor ?? "")
        .replace(/[\r\n;]/g, " ")
        .replace(/"/g, "'"),
    );
  return [
    COLUNAS_DO_CSV_DE_CASOS.map(([titulo]) => titulo).join(";"),
    ...(casos || []).map((caso) =>
      COLUNAS_DO_CSV_DE_CASOS.map(([, valor]) => celula(valor(caso))).join(";"),
    ),
  ].join("\n");
}

/** "avisos-analise-data-invalida-2026-10-06.csv" ("avisos-busca-…" na busca geral). */
export function nomeDoCsvDosCasos(aviso, agora = new Date()) {
  const base =
    texto(aviso?.conferencia)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "busca";
  const dois = (n) => String(n).padStart(2, "0");
  return `avisos-${base}-${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}.csv`;
}

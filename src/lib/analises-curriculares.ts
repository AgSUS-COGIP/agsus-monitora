import type {
  RegistroDaAnalise,
  EscopoDasAnalises,
  CampoDoFiltro,
  FiltrosDasAnalises,
  FiltroDaAnalise,
  PeriodoDasAnalises,
  RecorteDasAnalises,
  PendenciaDaAnalise,
  CargaDoResponsavel,
  DiaDasAnalises,
  PayloadDasAnalises,
} from "../modulos/analises/tipos.ts";
/*
  Regras da tela de Análises curriculares (src/modulos/analises/), sem React
  e sem banco: das linhas da lista enxuta (get_analises_dashboard_payload_v2)
  até o que a tela desenha — janela oficial e validação da data, filtros em
  cascata, recorte dos KPIs e do gráfico, indicadores, gráficos, pendências
  prioritárias, o texto do recorte, o detalhe da gaveta e o CSV.

  O que vem de outros arquivos de src/lib/: a área (area-do-painel-de-analises),
  o envelope e o detalhe da lista enxuta (lista-do-painel-de-analises), o
  parecer sob demanda e o município/UF (textos-do-painel-de-analises), a data
  no futuro (data-de-analise) e as modalidades (modalidades-de-concorrencia).

  Texto de planilha é sempre texto: nada aqui monta HTML; link só sai se for
  http(s) absoluto (`urlSegura`).
*/
import {
  colunasDoCsvDeAnalises,
  ehAreaSaudeIndigena,
  experienciaProfissionalDaLinha,
} from "./area-do-painel-de-analises.js";
import { sanitizeCsvCell } from "./csv-security.js";
import { dataDeAnaliseNoFuturo } from "./data-de-analise.js";
import { completarLinhaPeloEnvelope } from "./lista-do-painel-de-analises.js";
import { modalidadesDaConcorrencia } from "./modalidades-de-concorrencia.js";
import { urlDaPlanilhaGoogle } from "./planilhas.js";
import { municipioUfDaLinha } from "./textos-do-painel-de-analises.js";

export const SEM_RESPONSAVEL = "Sem responsável";

const texto = (valor: unknown) =>
  typeof valor === "string" ||
  typeof valor === "number" ||
  typeof valor === "boolean"
    ? String(valor).trim()
    : "";

/** Sem acento e sem caixa: quem busca "joao" acha "João". */
export const normalizar = (valor: unknown) =>
  texto(valor).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const contar = (
  linhas: readonly RegistroDaAnalise[],
  teste: (linha: RegistroDaAnalise) => unknown,
) => linhas.reduce((total, linha) => total + (teste(linha) ? 1 : 0), 0);

const comparar = (a: unknown, b: unknown) =>
  String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", { numeric: true });

/* ── Situação do processo (o escopo que a RPC devolve) ─────────────── */

export const ESCOPO_PADRAO = "ativo";
export const ESCOPOS = Object.freeze([
  Object.freeze({ valor: "ativo", rotulo: "Ativo" }),
  Object.freeze({ valor: "inativo", rotulo: "Inativo" }),
  Object.freeze({ valor: "todos", rotulo: "Todos" }),
]);

export function normalizarEscopo(valor: unknown): EscopoDasAnalises {
  const escopo = texto(valor).toLowerCase();
  return ESCOPOS.find((item) => item.valor === escopo)?.valor ?? ESCOPO_PADRAO;
}

export function rotuloDoEscopo(valor: unknown) {
  return (
    ESCOPOS.find((item) => item.valor === normalizarEscopo(valor))?.rotulo ??
    "Ativo"
  );
}

/* ── Linhas do payload ─────────────────────────────────────────────── */

/* Responsável em branco vira "Sem responsável" (filtro, gráfico e pendência). */
export function normalizarLinha(linha: RegistroDaAnalise): RegistroDaAnalise {
  if (!linha || typeof linha !== "object") return linha;
  if (texto(linha.responsavel_analise)) return linha;
  return {
    ...linha,
    responsavel_analise: SEM_RESPONSAVEL,
    responsavel_ausente: true,
  };
}

export const semResponsavel = (linha: RegistroDaAnalise) =>
  linha?.responsavel_ausente === true ||
  normalizar(linha?.responsavel_analise) === normalizar(SEM_RESPONSAVEL);

/**
 * As linhas do payload (colunas + arrays) como objetos, pelo nome da coluna,
 * com o que o envelope manda uma vez só (grupo, situação do edital).
 */
export function linhasDoPayload(entrada: unknown): RegistroDaAnalise[] {
  const payload = normalizarPayloadDasAnalises(entrada);
  const colunas = payload.columns;
  return payload.rows.map((valores) => {
    const linha: RegistroDaAnalise = {};
    colunas.forEach((coluna, indice) => {
      const valor = valores[indice];
      linha[coluna] =
        valor == null || ["string", "number", "boolean"].includes(typeof valor)
          ? (valor ?? null)
          : null;
    });
    return normalizarLinha(completarLinhaPeloEnvelope(linha, payload));
  });
}

/* ── Datas da planilha ─────────────────────────────────────────────── */

/*
  dd/mm/aaaa, aaaa-mm-dd ou data e hora ISO. Outro formato fica sem data (não
  adivinha mês/dia trocados).
*/
export function dataDaPlanilha(valor: unknown) {
  const bruto = texto(valor);
  if (!bruto) return null;
  let partes = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (partes)
    return new Date(
      Number(partes[3]),
      Number(partes[2]) - 1,
      Number(partes[1]),
    );
  partes = bruto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (partes)
    return new Date(
      Number(partes[1]),
      Number(partes[2]) - 1,
      Number(partes[3]),
    );
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(bruto)) {
    const data = new Date(bruto);
    return Number.isNaN(data.getTime()) ? null : data;
  }
  return null;
}

/* A data em dd/mm/aaaa; sem formato conhecido, o texto como veio. */
export function formatarData(valor: unknown) {
  const data = dataDaPlanilha(valor);
  return data ? data.toLocaleDateString("pt-BR") : texto(valor);
}

export function formatarDataHora(valor: unknown) {
  const data = dataDaPlanilha(valor);
  return data
    ? data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : texto(valor);
}

/* ── Janela oficial do edital e validação da data ──────────────────── */

const chaveDoEdital = (grupo: unknown, unidade: unknown, edital: unknown) =>
  [normalizar(grupo), normalizar(unidade), normalizar(edital)].join("|");
const editalAtivo = (edital: RegistroDaAnalise) =>
  edital?.ativo === true ||
  ["sim", "s", "ativo", "1", "true", "x"].includes(normalizar(edital?.ativo));

/*
  O edital da linha em `editais[]` (que traz a janela): grupo + unidade +
  edital; senão unidade + edital, se só um; senão o único ativo com esse
  número; senão o único com esse número. `match` diz qual regra casou.
*/
export function editalDaLinha(
  linha: RegistroDaAnalise,
  editais: readonly RegistroDaAnalise[],
) {
  return buscaDeEditais(editais)(linha);
}

/* A mesma regra, com os editais indexados uma vez (para muitas linhas). */
function buscaDeEditais(editais: readonly RegistroDaAnalise[]) {
  const porChave = new Map<string, RegistroDaAnalise>();
  const porNumero = new Map<string, RegistroDaAnalise[]>();
  for (const e of Array.isArray(editais) ? editais : []) {
    const chave = chaveDoEdital(e.grupo, e.unidade, e.edital);
    if (!porChave.has(chave)) porChave.set(chave, e);
    const numero = normalizar(e.edital);
    if (!porNumero.has(numero)) porNumero.set(numero, []);
    porNumero.get(numero)?.push(e);
  }
  return (
    linha: RegistroDaAnalise,
  ): (RegistroDaAnalise & { match: string }) | null => {
    const exato = porChave.get(
      chaveDoEdital(linha.grupo, linha.unidade, linha.edital),
    );
    if (exato) return { ...exato, match: "full" };
    const mesmoNumero = porNumero.get(normalizar(linha.edital)) || [];
    const unidade = normalizar(linha.unidade);
    const naUnidade = mesmoNumero.filter(
      (e) => normalizar(e.unidade) === unidade,
    );
    if (naUnidade.length === 1)
      return { ...naUnidade[0], match: "unit_edital" };
    const ativos = mesmoNumero.filter(editalAtivo);
    if (ativos.length === 1)
      return { ...ativos[0], match: "edital_ativo_unico" };
    if (mesmoNumero.length === 1)
      return { ...mesmoNumero[0], match: "edital_unico" };
    return null;
  };
}

/* Rótulo curto (filtro e chip) e a descrição (gaveta) de cada validação. */
export const VALIDACOES: Readonly<Record<string, string>> = Object.freeze({
  DENTRO_PERIODO: "Dentro do período",
  FORA_PERIODO: "Fora do período",
  SEM_DATA: "Sem data de análise",
  SEM_JANELA: "Sem janela configurada",
  DATA_FUTURA: "Data no futuro",
});
export const DESCRICAO_DA_VALIDACAO: Readonly<Record<string, string>> =
  Object.freeze({
    DENTRO_PERIODO: "Dentro do período configurado",
    FORA_PERIODO: "Fora do período configurado",
    SEM_DATA: "Sem data de análise informada",
    SEM_JANELA: "Sem janela configurada no edital",
    DATA_FUTURA: "Data de análise no futuro (corrija na planilha)",
  });

/** A data da análise contra a janela oficial do edital. */
export function validacaoDaJanela(
  linha: RegistroDaAnalise,
  agora = new Date(),
) {
  const analise = dataDaPlanilha(linha?.data_analise);
  const inicio = dataDaPlanilha(linha?.data_inicio_analise);
  const fim = dataDaPlanilha(linha?.data_fim_analise);
  let status = "DENTRO_PERIODO";
  if (!analise) status = "SEM_DATA";
  else if (dataDeAnaliseNoFuturo(analise, agora)) status = "DATA_FUTURA";
  else if (!inicio && !fim) status = "SEM_JANELA";
  else if ((inicio && analise < inicio) || (fim && analise > fim))
    status = "FORA_PERIODO";
  return {
    status,
    rotulo: DESCRICAO_DA_VALIDACAO[status],
    fora: status === "FORA_PERIODO" || status === "DATA_FUTURA",
  };
}

/* Os índices da busca geral (inclui o parecer, quando já veio) e da fila. */
export function comIndicesDeBusca<T extends RegistroDaAnalise>(linha: T) {
  return indexar({ ...linha });
}

function indexar<T extends RegistroDaAnalise>(linha: T) {
  const juntar = (campos: readonly string[]) =>
    normalizar(campos.map((c) => linha[c]).join(" "));
  return Object.assign(linha, {
    __busca: juntar([
      "grupo",
      "unidade",
      "edital",
      "codigo_vaga",
      "nome_vaga",
      "candidato",
      "responsavel_analise",
      "status_consolidado",
      "analise",
      "categoria",
      "modalidade_concorrencia",
    ]),
    __buscaDaFila: juntar([
      "grupo",
      "unidade",
      "edital",
      "codigo_vaga",
      "nome_vaga",
      "candidato",
      "status_consolidado",
      "etapa",
      "responsavel_analise",
      "analise",
      "modalidade_concorrencia",
    ]),
  });
}

/**
 * As linhas prontas para a tela: a janela do edital (quando a linha não traz),
 * a validação da data, o município/UF (fora da Saúde Indígena), os índices
 * da busca e a chave da linha (`__chave`: o id, ou a chave natural, ou a
 * posição). Devolve linhas novas; as de entrada não mudam.
 */
export function prepararLinhas(
  linhas: readonly RegistroDaAnalise[],
  {
    editais = [],
    area,
    agora = new Date(),
  }: {
    editais?: readonly RegistroDaAnalise[];
    area?: string;
    agora?: Date;
  } = {},
) {
  const saudeIndigena = ehAreaSaudeIndigena(area);
  const editalDe = buscaDeEditais(editais);
  return (Array.isArray(linhas) ? linhas : []).map((original, indice) => {
    const linha: RegistroDaAnalise & { __chave: string } = {
      ...original,
      __chave: "",
    };
    linha.__chave =
      texto(linha.id) || texto(linha.chave_natural) || `linha-${indice}`;
    const edital = editalDe(linha);
    if (edital) {
      if (!texto(linha.data_inicio_analise))
        linha.data_inicio_analise = edital.data_inicio_analise ?? null;
      if (!texto(linha.data_fim_analise))
        linha.data_fim_analise = edital.data_fim_analise ?? null;
    }
    const validacao = validacaoDaJanela(linha, agora);
    linha.data_validacao_status = validacao.status;
    linha.data_validacao_label = validacao.rotulo;
    if (!saudeIndigena) linha.municipio_uf = municipioUfDaLinha(linha, area);
    return indexar(linha);
  });
}

/* ── Filtros ───────────────────────────────────────────────────────── */

const um = (campo: string) => (linha: RegistroDaAnalise) => [
  texto(linha[campo]),
];

/*
  Os filtros de seleção múltipla, na ordem da tela. `avancado`: atrás do "Mais
  opções". `rotuloDoValor`: o que a opção mostra (o valor é o do dado).
*/
export const FILTROS: readonly FiltroDaAnalise[] = Object.freeze([
  {
    campo: "unidade",
    rotulo: "Unidade",
    todos: "Todas as unidades",
    valores: um("unidade"),
  },
  {
    campo: "municipio",
    rotulo: "Município/UF",
    todos: "Todos os municípios",
    valores: um("municipio_uf"),
  },
  {
    campo: "edital",
    rotulo: "Edital",
    todos: "Todos os editais",
    valores: um("edital"),
  },
  {
    campo: "vaga",
    rotulo: "Código da vaga",
    todos: "Todas as vagas",
    valores: um("codigo_vaga"),
  },
  {
    campo: "status",
    rotulo: "Status",
    todos: "Todos os status",
    valores: um("status_consolidado"),
  },
  {
    campo: "responsavel",
    rotulo: "Responsável",
    todos: "Todos os responsáveis",
    valores: um("responsavel_analise"),
  },
  {
    campo: "categoria",
    rotulo: "Categoria",
    todos: "Todas as categorias",
    avancado: true,
    valores: um("categoria"),
  },
  {
    campo: "modalidade",
    rotulo: "Modalidade de concorrência",
    todos: "Todas as modalidades",
    avancado: true,
    valores: (linha) =>
      modalidadesDaConcorrencia(linha.modalidade_concorrencia),
  },
  {
    campo: "validacao",
    rotulo: "Validação da janela",
    todos: "Todas",
    avancado: true,
    valores: um("data_validacao_status"),
    rotuloDoValor: (valor) => VALIDACOES[valor] || valor,
  },
]);

const FILTRO = Object.fromEntries(
  FILTROS.map((filtro) => [filtro.campo, filtro]),
) as Record<CampoDoFiltro, FiltroDaAnalise>;

export const FILTROS_VAZIOS: FiltrosDasAnalises = Object.freeze({
  unidade: [],
  municipio: [],
  edital: [],
  vaga: [],
  status: [],
  responsavel: [],
  categoria: [],
  modalidade: [],
  validacao: [],
  busca: "",
});

export function rotuloDoValor(campo: CampoDoFiltro, valor: string) {
  return FILTRO[campo]?.rotuloDoValor?.(valor) ?? valor;
}

const valoresDe = (campo: CampoDoFiltro, linha: RegistroDaAnalise) =>
  FILTRO[campo].valores(linha).map(texto).filter(Boolean);

/* Seleção de cada filtro como conjunto normalizado (vazio = sem filtro). */
function conjuntos(filtros?: Partial<FiltrosDasAnalises>) {
  return Object.fromEntries(
    FILTROS.map(({ campo }) => [
      campo,
      new Set((filtros?.[campo] || []).map(normalizar)),
    ]),
  ) as Record<CampoDoFiltro, Set<string>>;
}

function passaNoFiltro(
  linha: RegistroDaAnalise,
  campo: CampoDoFiltro,
  selecao: Set<string>,
) {
  if (!selecao.size) return true;
  return valoresDe(campo, linha).some((valor) =>
    selecao.has(normalizar(valor)),
  );
}

/** As linhas que passam em todos os filtros e na busca geral. */
export function filtrarLinhas<T extends RegistroDaAnalise>(
  linhas: readonly T[],
  filtros?: Partial<FiltrosDasAnalises>,
) {
  const selecoes = conjuntos(filtros);
  const busca = normalizar(filtros?.busca);
  return (linhas || []).filter(
    (linha) =>
      FILTROS.every(({ campo }) =>
        passaNoFiltro(linha, campo, selecoes[campo]),
      ) &&
      (!busca || String(linha.__busca || "").includes(busca)),
  );
}

/**
 * As opções de cada filtro `{ value, label }`, em cascata e numa passada só:
 * as de um filtro saem das linhas que passam nos outros (sem contar ele
 * mesmo, nem a busca), em ordem de rótulo, sem repetir.
 */
export function opcoesDosFiltros(
  linhas: readonly RegistroDaAnalise[],
  filtros?: Partial<FiltrosDasAnalises>,
) {
  const selecoes = conjuntos(filtros);
  const vistos = Object.fromEntries(
    FILTROS.map(({ campo }) => [campo, new Map<string, string>()]),
  ) as Record<CampoDoFiltro, Map<string, string>>;
  for (const linha of linhas || []) {
    const passa = Object.fromEntries(
      FILTROS.map(({ campo }) => [
        campo,
        passaNoFiltro(linha, campo, selecoes[campo]),
      ]),
    );
    for (const { campo } of FILTROS) {
      if (
        !FILTROS.every((outro) => outro.campo === campo || passa[outro.campo])
      )
        continue;
      for (const valor of valoresDe(campo, linha)) {
        const chave = normalizar(valor);
        if (!vistos[campo].has(chave)) vistos[campo].set(chave, valor);
      }
    }
  }
  return Object.fromEntries(
    FILTROS.map(({ campo }) => [
      campo,
      [...vistos[campo].values()]
        .map((valor) => ({ value: valor, label: rotuloDoValor(campo, valor) }))
        .sort((a, b) => comparar(a.label, b.label)),
    ]),
  );
}

/*
  Depois de uma carga nova (outro escopo, outra versão), a seleção fica só com
  o que ainda existe nas linhas, na grafia de agora. Devolve o mesmo objeto se
  nada mudou.
*/
export function apararSelecao(
  filtros: FiltrosDasAnalises,
  linhas: readonly RegistroDaAnalise[],
) {
  let mudou = false;
  const proximo = { ...filtros };
  for (const { campo } of FILTROS) {
    const selecao = filtros[campo] || [];
    if (!selecao.length) continue;
    const existentes = new Map<string, string>();
    for (const linha of linhas || [])
      for (const valor of valoresDe(campo, linha))
        existentes.set(normalizar(valor), valor);
    const aparada = selecao
      .map((valor) => existentes.get(normalizar(valor)))
      .filter((valor): valor is string => valor !== undefined);
    if (
      aparada.length !== selecao.length ||
      aparada.some((valor, i) => valor !== selecao[i])
    ) {
      proximo[campo] = aparada;
      mudou = true;
    }
  }
  return mudou ? proximo : filtros;
}

/** Quantos filtros estão em uso (a busca conta um). */
export function quantosFiltros(
  filtros: Partial<FiltrosDasAnalises>,
  { soAvancados = false } = {},
) {
  const usados = FILTROS.filter(
    ({ campo, avancado }) =>
      (!soAvancados || avancado) && (filtros?.[campo] || []).length,
  ).length;
  return usados + (texto(filtros?.busca) ? 1 : 0);
}

/* O filtro Município/UF só existe onde as linhas trazem município (Projetos e SEDE). */
export function temMunicipio(
  linhas: readonly RegistroDaAnalise[],
  area: string,
) {
  return (
    !ehAreaSaudeIndigena(area) &&
    (linhas || []).some((l) => texto(l.municipio_uf))
  );
}

/* ── KPIs e o recorte visual (KPI e barra do gráfico) ──────────────── */

export const STATUS_DO_KPI: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    analisado: Object.freeze(["Revisar", "Aprovado", "Reprovado"]),
    pendente: Object.freeze(["Pendente"]),
    revisar: Object.freeze(["Revisar"]),
    aprovado: Object.freeze(["Aprovado"]),
    reprovado: Object.freeze(["Reprovado"]),
  });
export const ROTULO_DO_KPI: Readonly<Record<string, string>> = Object.freeze({
  total: "Total de aptos p/ análise",
  analisado: "Análises realizadas",
  pendente: "Pendentes",
  revisar: "Em revisão",
  aprovado: "Aprovados",
  reprovado: "Reprovados",
});

/** O recorte dos KPIs (status) e da barra clicada no gráfico (responsável). */
export function recorteVisual<T extends RegistroDaAnalise>(
  linhas: readonly T[],
  { kpi = "", responsavel = "" } = {},
) {
  const status = STATUS_DO_KPI[kpi] || [];
  return (linhas || []).filter(
    (linha) =>
      (!status.length || status.includes(texto(linha.status_consolidado))) &&
      (!responsavel || texto(linha.responsavel_analise) === responsavel),
  );
}

export function calcularKpis(linhas: readonly RegistroDaAnalise[]) {
  const lista = linhas || [];
  const de = (status: string) =>
    contar(lista, (l) => texto(l.status_consolidado) === status);
  const pendente = de("Pendente");
  const revisar = de("Revisar");
  const aprovado = de("Aprovado");
  const reprovado = de("Reprovado");
  const total = lista.length;
  return {
    total,
    analisado: revisar + aprovado + reprovado,
    pendente,
    revisar,
    aprovado,
    reprovado,
    taxa: total ? Math.round(((aprovado + reprovado) / total) * 100) : 0,
  };
}

/* ── Gráficos ──────────────────────────────────────────────────────── */

export const STATUS_DO_GRAFICO = Object.freeze([
  "Pendente",
  "Revisar",
  "Aprovado",
  "Reprovado",
] as const);

/* Carga por responsável, empilhada por status (status desconhecido conta como Pendente). */
export function analisesPorResponsavel(
  linhas: readonly RegistroDaAnalise[],
  limite = 12,
) {
  const porRotulo = new Map<string, CargaDoResponsavel>();
  for (const linha of linhas || []) {
    const rotulo = texto(linha.responsavel_analise) || SEM_RESPONSAVEL;
    if (!porRotulo.has(rotulo))
      porRotulo.set(rotulo, {
        rotulo,
        Pendente: 0,
        Revisar: 0,
        Aprovado: 0,
        Reprovado: 0,
        total: 0,
      });
    const item = porRotulo.get(rotulo)!;
    const status = texto(linha.status_consolidado);
    const campo =
      STATUS_DO_GRAFICO.find((valor) => valor === status) ?? "Pendente";
    item[campo] += 1;
    item.total += 1;
  }
  return [...porRotulo.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

/*
  Análises feitas por dia; `fora` e `futuras` marcam os pontos em vermelho.
  Só conta análise com decisão (Aprovado, Reprovado ou Revisar): pendente com
  data (planilha refeita, data preenchida antes da análise) não é análise feita.
*/
const STATUS_COM_DECISAO = new Set(["Aprovado", "Reprovado", "Revisar"]);

export function tendenciaDiaria(linhas: readonly RegistroDaAnalise[]) {
  const porDia = new Map<string, DiaDasAnalises>();
  for (const linha of linhas || []) {
    if (!STATUS_COM_DECISAO.has(texto(linha.status_consolidado))) continue;
    const rotulo = formatarData(linha.data_analise);
    if (!rotulo) continue;
    if (!porDia.has(rotulo))
      porDia.set(rotulo, {
        rotulo,
        valor: 0,
        fora: 0,
        futuras: 0,
        data: dataDaPlanilha(linha.data_analise),
        chave: chaveDoDia(linha.data_analise),
      });
    const dia = porDia.get(rotulo)!;
    dia.valor += 1;
    if (linha.data_validacao_status === "FORA_PERIODO") dia.fora += 1;
    if (linha.data_validacao_status === "DATA_FUTURA") dia.futuras += 1;
  }
  return [...porDia.values()].sort(
    (a, b) => (a.data?.getTime() || 0) - (b.data?.getTime() || 0),
  );
}

/* ── Filtro por data (o dia clicado em "Análises por data") ────────── */

const doisDigitos = (numero: number) => String(numero).padStart(2, "0");
const CHAVE_DO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O dia da data da análise como chave `aaaa-mm-dd` (no fuso do navegador, o
 * mesmo do rótulo do gráfico); "" sem data reconhecida. É o formato do
 * `<input type="date">`, então o clique no gráfico e o campo falam a mesma
 * língua.
 */
export function chaveDoDia(valor: unknown) {
  const data = dataDaPlanilha(valor);
  if (!data) return "";
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

/** Sem filtro de data. */
export const PERIODO_VAZIO: PeriodoDasAnalises = Object.freeze({
  inicio: "",
  fim: "",
});

/** Só chaves válidas, com início ≤ fim (trocados, desvira). */
export function normalizarPeriodo(
  periodo?: Partial<PeriodoDasAnalises> | null,
) {
  const valida = (chave: unknown) =>
    CHAVE_DO_DIA.test(texto(chave)) ? texto(chave) : "";
  const inicio = valida(periodo?.inicio);
  const fim = valida(periodo?.fim);
  if (inicio && fim && inicio > fim) return { inicio: fim, fim: inicio };
  return { inicio, fim };
}

export function temPeriodo(periodo?: Partial<PeriodoDasAnalises> | null) {
  const { inicio, fim } = normalizarPeriodo(periodo);
  return Boolean(inicio || fim);
}

/** O dia (chave) está dentro do período? As pontas contam; sem período, sim. */
export function diaNoPeriodo(
  chave: string,
  periodo: Partial<PeriodoDasAnalises>,
) {
  const { inicio, fim } = normalizarPeriodo(periodo);
  if (!inicio && !fim) return true;
  if (!chave) return false;
  return (!inicio || chave >= inicio) && (!fim || chave <= fim);
}

/**
 * As linhas cuja data da análise cai no período — o mesmo campo do gráfico.
 * Com período, a linha sem data sai; sem período, todas ficam (mesmo array).
 */
export function filtrarPorPeriodo<T extends RegistroDaAnalise>(
  linhas: readonly T[],
  periodo: Partial<PeriodoDasAnalises>,
) {
  const lista = linhas || [];
  if (!temPeriodo(periodo)) return lista;
  return lista.filter((linha) =>
    diaNoPeriodo(chaveDoDia(linha.data_analise), periodo),
  );
}

/**
 * O período depois de clicar num dia do gráfico: um dia só; o mesmo dia de
 * novo tira o filtro. `estender` (Shift + clique): do início do período atual
 * até o dia clicado, em qualquer ordem.
 */
export function periodoDoClique(
  atual: PeriodoDasAnalises,
  dia: string,
  { estender = false } = {},
) {
  if (!CHAVE_DO_DIA.test(texto(dia))) return normalizarPeriodo(atual);
  const { inicio, fim } = normalizarPeriodo(atual);
  if (estender && (inicio || fim))
    return normalizarPeriodo({ inicio: inicio || fim, fim: dia });
  if (inicio === dia && fim === dia) return PERIODO_VAZIO;
  return { inicio: dia, fim: dia };
}

const dataDaChave = (chave: string) => {
  const [ano, mes, dia] = chave.split("-");
  return `${dia}/${mes}/${ano}`;
};

/** "28/09/2026", "01/09/2026 a 15/09/2026", "a partir de …" ou "até …"; "" sem período. */
export function rotuloDoPeriodo(periodo: Partial<PeriodoDasAnalises>) {
  const { inicio, fim } = normalizarPeriodo(periodo);
  if (inicio && fim)
    return inicio === fim
      ? dataDaChave(inicio)
      : `${dataDaChave(inicio)} a ${dataDaChave(fim)}`;
  if (inicio) return `a partir de ${dataDaChave(inicio)}`;
  if (fim) return `até ${dataDaChave(fim)}`;
  return "";
}

/* ── Pendências prioritárias ───────────────────────────────────────── */

const n = (valor: number) => valor.toLocaleString("pt-BR");

/*
  O que pede ação no recorte, da mais grave para a menos (até 8). Cada uma
  tem um atalho que filtra a tela: `{ tipo: "kpi" | "validacao" |
  "responsavel", valor }`.
*/
export function pendenciasPrioritarias(
  linhas: readonly RegistroDaAnalise[],
): PendenciaDaAnalise[] {
  const lista = linhas || [];
  const status = (s: string) =>
    contar(lista, (l) => texto(l.status_consolidado) === s);
  const validacao = (v: string) =>
    contar(lista, (l) => l.data_validacao_status === v);
  const futura = validacao("DATA_FUTURA");
  const fora = validacao("FORA_PERIODO");
  const semResp = contar(lista, semResponsavel);
  const pendentes = status("Pendente");
  const revisar = status("Revisar");
  const semData = contar(
    lista,
    (l) => texto(l.etapa) && !texto(l.data_analise),
  );
  const itens: (0 | PendenciaDaAnalise)[] = [
    futura && {
      chave: "data-futura",
      titulo: "Data de análise no futuro",
      detalhe: `${n(futura)} análise(s) com data depois de hoje. Corrija na planilha de origem.`,
      tom: "perigo",
      atalho: { tipo: "validacao", valor: "DATA_FUTURA" },
    },
    fora && {
      chave: "fora-do-periodo",
      titulo: "Data fora do período",
      detalhe: `${n(fora)} análise(s) fora da janela oficial do edital.`,
      tom: "perigo",
      atalho: { tipo: "validacao", valor: "FORA_PERIODO" },
    },
    semResp && {
      chave: "sem-responsavel",
      titulo: SEM_RESPONSAVEL,
      detalhe: `${n(semResp)} registro(s) sem responsável de análise.`,
      tom: "perigo",
      atalho: { tipo: "responsavel", valor: SEM_RESPONSAVEL },
    },
    pendentes && {
      chave: "pendentes",
      titulo: "Pendentes",
      detalhe: `${n(pendentes)} registro(s) pendentes no recorte atual.`,
      tom: "alerta",
      atalho: { tipo: "kpi", valor: "pendente" },
    },
    revisar && {
      chave: "em-revisao",
      titulo: "Em revisão",
      detalhe: `${n(revisar)} registro(s) aguardando revisão.`,
      tom: "alerta",
      atalho: { tipo: "kpi", valor: "revisar" },
    },
    semData && {
      chave: "etapa-sem-data",
      titulo: "Etapa sem data",
      detalhe: `${n(semData)} registro(s) com etapa, mas sem data de análise.`,
      tom: "alerta",
      atalho: { tipo: "validacao", valor: "SEM_DATA" },
    },
  ];
  return itens
    .filter((item): item is PendenciaDaAnalise => Boolean(item))
    .slice(0, 8);
}

/* ── Recorte ativo ─────────────────────────────────────────────────── */

/**
 * O texto do recorte: a situação do processo, os filtros, a busca, o KPI e o
 * responsável clicado no gráfico.
 */
export function descricaoDoRecorte({
  escopo,
  filtros,
  kpi = "",
  responsavel = "",
  periodo = PERIODO_VAZIO,
}: RecorteDasAnalises) {
  const partes = [`Situação do processo: ${rotuloDoEscopo(escopo)}`];
  for (const { campo, rotulo } of FILTROS) {
    const valores = filtros?.[campo] || [];
    if (valores.length)
      partes.push(
        `${rotulo}: ${valores.map((v) => rotuloDoValor(campo, v)).join(", ")}`,
      );
  }
  if (texto(filtros?.busca)) partes.push(`Busca: ${texto(filtros?.busca)}`);
  if (STATUS_DO_KPI[kpi]) partes.push(`KPI: ${ROTULO_DO_KPI[kpi]}`);
  if (responsavel) partes.push(`Responsável no gráfico: ${responsavel}`);
  if (temPeriodo(periodo)) partes.push(`Data: ${rotuloDoPeriodo(periodo)}`);
  return `Recorte ativo: ${partes.join(" · ")}`;
}

/* As marcas do recorte: a janela oficial, as análises fora dela e as sem janela. */
export function marcasDoRecorte(linhas: readonly RegistroDaAnalise[]) {
  const lista = linhas || [];
  const janelas = new Map<string, { inicio: string; fim: string }>();
  for (const linha of lista) {
    const inicio = formatarData(linha.data_inicio_analise);
    const fim = formatarData(linha.data_fim_analise);
    if (inicio || fim) janelas.set(`${inicio}|${fim}`, { inicio, fim });
  }
  const fora = contar(lista, (l) => l.data_validacao_status === "FORA_PERIODO");
  const semJanela = contar(
    lista,
    (l) => l.data_validacao_status === "SEM_JANELA",
  );
  const marcas = [];
  if (janelas.size === 1) {
    const { inicio, fim } = janelas.values().next().value!;
    marcas.push({
      chave: "janela",
      icone: "fa-calendar-days",
      texto: `Janela oficial: ${inicio || "--"} a ${fim || "--"}`,
    });
  } else if (janelas.size > 1) {
    marcas.push({
      chave: "janela",
      icone: "fa-calendar-days",
      texto: `${n(janelas.size)} janelas oficiais no recorte`,
    });
  }
  marcas.push({
    chave: "fora",
    tom: fora ? "alerta" : "sucesso",
    icone: fora ? "fa-triangle-exclamation" : "fa-circle-check",
    texto: `${n(fora)} análise(s) fora do período`,
  });
  if (semJanela)
    marcas.push({
      chave: "sem-janela",
      tom: "alerta",
      icone: "fa-circle-info",
      texto: `${n(semJanela)} sem janela configurada`,
    });
  return marcas;
}

/* ── Fila ──────────────────────────────────────────────────────────── */

/** A busca da fila (só a tabela; inclui etapa e o parecer, quando já veio). */
export function filtrarPelaBuscaDaFila<T extends RegistroDaAnalise>(
  linhas: readonly T[],
  busca: string,
) {
  const termo = normalizar(busca);
  if (!termo) return linhas;
  return linhas.filter((linha) =>
    String(linha.__buscaDaFila || "").includes(termo),
  );
}

export const TOM_DO_STATUS: Readonly<Record<string, string>> = Object.freeze({
  aprovado: "aprovado",
  reprovado: "reprovado",
  revisar: "revisar",
  pendente: "pendente",
});

/** Tom do selo de status (Selo de src/ui/). */
export function tomDoStatus(status: unknown) {
  return TOM_DO_STATUS[normalizar(status)] || "neutro";
}

/** A hora do dado mais novo: das linhas (updated_at) ou do envelope. */
export function ultimaAtualizacao(
  linhas: readonly RegistroDaAnalise[],
  payload?: RegistroDaAnalise | null,
) {
  const datas = (linhas || [])
    .map((l) => l.updated_at || l.ultima_atualizacao)
    .filter(Boolean);
  if (!datas.length && payload?.atualizado_em)
    datas.push(payload.atualizado_em);
  return (
    datas
      .map((valor) => ({ valor, data: dataDaPlanilha(valor) }))
      .filter((item) => item.data)
      .sort((a, b) => (a.data?.getTime() ?? 0) - (b.data?.getTime() ?? 0))
      .pop()?.valor ?? null
  );
}

/* ── Detalhe da gaveta ─────────────────────────────────────────────── */

const VAZIOS = new Set(["", "-", "--", "não informado", "sem informação"]);
const temValor = (valor: unknown) => !VAZIOS.has(texto(valor).toLowerCase());

/** Link http(s) absoluto, ou "" (nada de `javascript:` nem caminho relativo). */
export function urlSegura(valor: unknown) {
  const bruto = texto(valor);
  if (!bruto) return "";
  try {
    const url = new URL(bruto);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

const par = (rotulo: string, valor: unknown): [string, string] => [
  rotulo,
  texto(valor),
];
const soComValor = (pares: [string, string][]) =>
  pares.filter(([, valor]) => temValor(valor));

/**
 * O que a gaveta mostra de uma linha (já com o detalhamento, se veio):
 * título, status, responsável, contexto, links e as seções de pares
 * rótulo/valor. Pares sem valor saem; seção vazia sai.
 */
export function detalheDaAnalise(
  linha: RegistroDaAnalise | null,
  area: string,
) {
  const l = linha || {};
  const inicio = formatarData(l.data_inicio_analise);
  const fim = formatarData(l.data_fim_analise);
  const pontuacaoDaArea = ehAreaSaudeIndigena(area)
    ? [
        par("Critério étnico", l.pontuacao_criterio_etnico),
        par("Exp. Saúde Indígena", l.experiencia_saude_indigena_total),
        par("Exp. Atenção Básica", l.experiencia_atencao_basica_total),
      ]
    : [
        par(
          "Tempo de experiência profissional",
          experienciaProfissionalDaLinha(l),
        ),
      ];
  const secoes = [
    {
      chave: "status",
      titulo: "Situação da análise",
      icone: "fa-circle-check",
      itens: soComValor([
        par("Etapa", l.etapa),
        par("Data da análise", formatarData(l.data_analise)),
        par(
          "Validação",
          DESCRICAO_DA_VALIDACAO[texto(l.data_validacao_status)] ||
            l.data_validacao_status,
        ),
        par(
          "Janela oficial",
          inicio || fim ? `${inicio || "--"} a ${fim || "--"}` : "",
        ),
      ]),
    },
    {
      chave: "result",
      titulo: "Resultado",
      icone: "fa-chart-simple",
      itens: soComValor([
        par("Nota final", l.nota_final_ajustada),
        par("Modalidade", l.modalidade_concorrencia),
      ]),
    },
    {
      chave: "score",
      titulo: "Composição da pontuação",
      icone: "fa-list-check",
      itens: soComValor([
        par("Escolaridade", l.pontuacao_escolaridade),
        par("Cursos", l.pontuacao_cursos_aperfeicoamento),
        par("Experiência profissional", l.pontuacao_experiencia_profissional),
        ...pontuacaoDaArea,
      ]),
    },
  ].filter((secao) => secao.itens.length);
  return {
    titulo: texto(l.candidato) || "Registro da análise",
    status: texto(l.status_consolidado) || "Pendente",
    responsavel: texto(l.responsavel_analise) || SEM_RESPONSAVEL,
    contexto: soComValor([
      par("Grupo", l.grupo),
      par("Unidade", l.unidade),
      par("Edital", l.edital),
      par("Código da vaga", l.codigo_vaga),
      par("Vaga", l.nome_vaga),
      par("Município/UF", l.municipio_uf),
    ]),
    origem: urlSegura(urlDaPlanilhaGoogle(l.origem_arquivo_id)),
    pdf: urlSegura(l.link_pdf),
    secoes,
  };
}

/* ── CSV ───────────────────────────────────────────────────────────── */

export const COLUNAS_DO_CSV = Object.freeze([
  "edital_status",
  "grupo",
  "unidade",
  "edital",
  "codigo_vaga",
  "nome_vaga",
  "candidato",
  "status_consolidado",
  "etapa",
  "data_analise",
  "responsavel_analise",
  "nota_final_ajustada",
  "modalidade_concorrencia",
  "link_pdf",
  "data_validacao_status",
  "analise",
]);

/*
  O CSV do recorte (separado por `;`), com as colunas a mais fora da Saúde
  Indígena. Quebra de linha, `;` e aspas saem da célula; célula que começa
  como fórmula ganha um apóstrofo (csv-security.js).
*/
export function csvDasAnalises(
  linhas: readonly RegistroDaAnalise[],
  area: string,
) {
  const colunas = colunasDoCsvDeAnalises(COLUNAS_DO_CSV, area);
  const celula = (valor: unknown) =>
    sanitizeCsvCell(
      String(valor ?? "")
        .replace(/[\r\n;]/g, " ")
        .replace(/"/g, "'"),
    );
  return [
    colunas.join(";"),
    ...(linhas || []).map((linha) =>
      colunas.map((c) => celula(linha[c])).join(";"),
    ),
  ].join("\n");
}

/** Valida o envelope antes de interpretar dados externos ou persistidos no navegador. */
export function normalizarPayloadDasAnalises(
  entrada: unknown,
): PayloadDasAnalises {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada))
    throw new Error("Payload de Análises inválido.");
  const dados = entrada as Record<string, unknown>;
  if (
    !Array.isArray(dados.columns) ||
    !dados.columns.every(
      (coluna): coluna is string =>
        typeof coluna === "string" &&
        coluna !== "__proto__" &&
        coluna !== "constructor" &&
        coluna !== "prototype",
    ) ||
    !Array.isArray(dados.rows) ||
    !dados.rows.every((linha): linha is unknown[] => Array.isArray(linha))
  )
    throw new Error("Payload de Análises inválido.");
  const { editais, ...envelope } = dados;
  return {
    ...envelope,
    columns: dados.columns,
    rows: dados.rows,
    ...(Array.isArray(editais)
      ? {
          editais: editais.filter(
            (edital): edital is RegistroDaAnalise =>
              Boolean(edital) &&
              typeof edital === "object" &&
              !Array.isArray(edital),
          ),
        }
      : {}),
  };
}

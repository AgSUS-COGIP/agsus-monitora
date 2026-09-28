/*
  O painel de Análises por área, sem DOM (`src/componentes/analises-da-area/`).

  Os dados vêm de `get_analises_da_area(p_area, p_scope)` (migration
  20260928160000), em formato posicional: `columns` traz o nome de cada coluna
  uma vez e `rows`, as linhas como listas na mesma ordem. Aqui as linhas viram
  objetos e daqui saem os filtros, os indicadores, os gráficos e o CSV.

  Os status são os de `status_consolidado` no banco: Pendente, Revisar,
  Aprovado e Reprovado. "Realizadas" soma Revisar, Aprovado e Reprovado, e a
  taxa de conclusão é (Aprovado + Reprovado) / total — as mesmas contas do
  painel antigo (`src/analises/analises-app.js`, `kpiStatuses`).
*/

import { sanitizeCsvCell } from "./csv-security.js";

export const AREA_SAUDE_INDIGENA = "saude-indigena";

export const ESCOPOS = Object.freeze([
  ["ativo", "Ativo"],
  ["inativo", "Inativo"],
  ["todos", "Todos"],
]);

export const STATUS = Object.freeze({
  pendente: "Pendente",
  revisar: "Revisar",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
});

/* Ordem de exibição dos status (filtro, gráfico, legenda). */
export const ORDEM_DOS_STATUS = Object.freeze([
  STATUS.aprovado,
  STATUS.reprovado,
  STATUS.revisar,
  STATUS.pendente,
]);

/* Tom de cada status: success/danger/warning/info, como os selos do app. */
export const TOM_DO_STATUS = Object.freeze({
  [STATUS.aprovado]: "green",
  [STATUS.reprovado]: "red",
  [STATUS.revisar]: "blue",
  [STATUS.pendente]: "amber",
});

export function tomDoStatus(status) {
  return TOM_DO_STATUS[texto(status)] || "neutral";
}

/*
  Os indicadores, na ordem da fileira. `status` diz o que o clique filtra;
  "Total" e "Taxa de conclusão" não filtram (clicar neles limpa o filtro).
*/
export const INDICADORES = Object.freeze([
  Object.freeze({
    chave: "total",
    rotulo: "Total aptos",
    tom: "blue",
    icone: "fa-users",
    status: [],
  }),
  Object.freeze({
    chave: "realizadas",
    rotulo: "Realizadas",
    tom: "green",
    icone: "fa-list-check",
    status: [STATUS.revisar, STATUS.aprovado, STATUS.reprovado],
  }),
  Object.freeze({
    chave: "pendentes",
    rotulo: "Pendentes",
    tom: "amber",
    icone: "fa-clock",
    status: [STATUS.pendente],
  }),
  Object.freeze({
    chave: "revisar",
    rotulo: "Em revisão",
    tom: "blue",
    icone: "fa-magnifying-glass",
    status: [STATUS.revisar],
  }),
  Object.freeze({
    chave: "aprovados",
    rotulo: "Aprovados",
    tom: "green",
    icone: "fa-circle-check",
    status: [STATUS.aprovado],
  }),
  Object.freeze({
    chave: "reprovados",
    rotulo: "Reprovados",
    tom: "red",
    icone: "fa-circle-xmark",
    status: [STATUS.reprovado],
  }),
  Object.freeze({
    chave: "taxa",
    rotulo: "Taxa de conclusão",
    tom: "neutral",
    icone: "fa-chart-pie",
    status: [],
  }),
]);

export const FILTROS_VAZIOS = Object.freeze({
  unidade: "",
  edital: "",
  vaga: "",
  status: "",
  responsavel: "",
  municipio: "",
  busca: "",
  /** Indicador clicado (chave de INDICADORES); vazio = nenhum. */
  indicador: "",
});

const texto = (valor) => String(valor ?? "").trim();

/** Minúsculas e sem acento, para comparar e buscar. */
export function normalizar(valor) {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/*
  Município e UF a partir do nome da vaga ("Cargo 2: Enfermeiro - UBS móvel
  Seropédica/RJ - Cadastro Reserva"). O banco já manda os dois; isto é a rede
  de segurança para linha sem eles (payload antigo, cache). A expressão é a
  mesma da RPC.
*/
const LOCAL_DA_VAGA = /UBS m[óo]vel ([^/]+)\/([A-Z]{2})/;

export function municipioDaVaga(nomeVaga) {
  const casamento = LOCAL_DA_VAGA.exec(String(nomeVaga ?? ""));
  if (!casamento) return { municipio: "", uf: "" };
  return { municipio: casamento[1].trim(), uf: casamento[2] };
}

/** "Seropédica/RJ", ou "" sem município. */
export function rotuloDoMunicipio(linha) {
  return linha?.municipio
    ? `${linha.municipio}${linha.uf ? `/${linha.uf}` : ""}`
    : "";
}

/*
  columns[] + rows[][] → objetos. Coluna que falte no payload fica `null`;
  município e UF, se vierem vazios, saem do nome da vaga.
*/
export function linhasDoPayload(payload) {
  const colunas = Array.isArray(payload?.columns) ? payload.columns : [];
  const linhas = Array.isArray(payload?.rows) ? payload.rows : [];
  return linhas.map((valores) => {
    const linha = {};
    colunas.forEach((coluna, indice) => {
      linha[coluna] = Array.isArray(valores) ? (valores[indice] ?? null) : null;
    });
    if (!linha.municipio) {
      const local = municipioDaVaga(linha.nome_vaga);
      linha.municipio = local.municipio || null;
      linha.uf = local.uf || null;
    }
    // Pré-calculado: a busca roda a cada tecla sobre milhares de linhas.
    linha.textoDeBusca = textoDeBusca(linha);
    return linha;
  });
}

/** A área tem análises com município (hoje, Projetos): mostra o filtro e a coluna. */
export function temMunicipio(linhas) {
  return (Array.isArray(linhas) ? linhas : []).some((linha) =>
    Boolean(linha?.municipio),
  );
}

export function statusDoIndicador(chave) {
  return INDICADORES.find((item) => item.chave === chave)?.status ?? [];
}

/* Campos em que a busca procura. */
const CAMPOS_DA_BUSCA = [
  "candidato",
  "nome_vaga",
  "codigo_vaga",
  "responsavel_analise",
  "unidade",
  "edital",
  "municipio",
];

export function textoDeBusca(linha) {
  return CAMPOS_DA_BUSCA.map((campo) => normalizar(linha?.[campo])).join(" ");
}

/*
  Todos os filtros menos o do indicador (os indicadores contam o que os outros
  filtros deixam; senão, clicar em "Aprovados" zeraria os demais cartões).
*/
export function filtrarSemIndicador(linhas, filtros = FILTROS_VAZIOS) {
  const f = { ...FILTROS_VAZIOS, ...filtros };
  const busca = normalizar(f.busca);
  return (Array.isArray(linhas) ? linhas : []).filter((linha) => {
    if (f.unidade && texto(linha.unidade) !== f.unidade) return false;
    if (f.edital && texto(linha.edital) !== f.edital) return false;
    if (f.vaga && texto(linha.nome_vaga) !== f.vaga) return false;
    if (f.status && texto(linha.status_consolidado) !== f.status) return false;
    if (f.responsavel && texto(linha.responsavel_analise) !== f.responsavel)
      return false;
    if (f.municipio && rotuloDoMunicipio(linha) !== f.municipio) return false;
    if (busca && !(linha.textoDeBusca ?? textoDeBusca(linha)).includes(busca))
      return false;
    return true;
  });
}

export function filtrarAnalises(linhas, filtros = FILTROS_VAZIOS) {
  const base = filtrarSemIndicador(linhas, filtros);
  const status = statusDoIndicador(filtros?.indicador);
  if (!status.length) return base;
  return base.filter((linha) =>
    status.includes(texto(linha.status_consolidado)),
  );
}

/*
  Os números dos indicadores. `taxa` é inteira (0–100): (aprovados +
  reprovados) / total, arredondada, como no painel antigo.
*/
export function contarIndicadores(linhas) {
  const lista = Array.isArray(linhas) ? linhas : [];
  const conta = { pendentes: 0, revisar: 0, aprovados: 0, reprovados: 0 };
  for (const linha of lista) {
    const status = texto(linha.status_consolidado);
    if (status === STATUS.pendente) conta.pendentes += 1;
    else if (status === STATUS.revisar) conta.revisar += 1;
    else if (status === STATUS.aprovado) conta.aprovados += 1;
    else if (status === STATUS.reprovado) conta.reprovados += 1;
  }
  const total = lista.length;
  return {
    total,
    realizadas: conta.revisar + conta.aprovados + conta.reprovados,
    ...conta,
    taxa: total
      ? Math.round(((conta.aprovados + conta.reprovados) / total) * 100)
      : 0,
  };
}

export function valorDoIndicador(chave, contagem) {
  if (chave === "taxa") return `${contagem.taxa}%`;
  return Number(contagem[chave] || 0).toLocaleString("pt-BR");
}

/*
  Clique num indicador: liga o filtro dele; clicar de novo (ou em Total/Taxa,
  que não filtram) desliga.
*/
export function alternarIndicador(atual, chave) {
  if (!statusDoIndicador(chave).length) return "";
  return atual === chave ? "" : chave;
}

const comparar = (a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });

function distintos(linhas, extrair) {
  const valores = new Set();
  for (const linha of linhas) {
    const valor = texto(extrair(linha));
    if (valor) valores.add(valor);
  }
  return [...valores].sort(comparar);
}

/* As opções de cada filtro, sem repetição e em ordem alfabética. */
export function opcoesDosFiltros(linhas) {
  const lista = Array.isArray(linhas) ? linhas : [];
  const status = distintos(lista, (linha) => linha.status_consolidado);
  return {
    unidades: distintos(lista, (linha) => linha.unidade),
    editais: distintos(lista, (linha) => linha.edital),
    vagas: distintos(lista, (linha) => linha.nome_vaga),
    responsaveis: distintos(lista, (linha) => linha.responsavel_analise),
    municipios: distintos(lista, rotuloDoMunicipio),
    // Os conhecidos na ordem de sempre; algum inesperado vai para o fim.
    status: [
      ...ORDEM_DOS_STATUS.filter((item) => status.includes(item)),
      ...status.filter((item) => !ORDEM_DOS_STATUS.includes(item)),
    ],
  };
}

export const SEM_RESPONSAVEL = "Sem responsável";

/*
  Análises por responsável, empilhadas por status, dos que mais têm para os
  que menos têm (empate: nome). Só os `limite` primeiros.
*/
export function porResponsavel(linhas, limite = 12) {
  const grupos = new Map();
  for (const linha of Array.isArray(linhas) ? linhas : []) {
    const nome = texto(linha.responsavel_analise) || SEM_RESPONSAVEL;
    const status = texto(linha.status_consolidado) || "Sem status";
    const grupo = grupos.get(nome) || {
      responsavel: nome,
      total: 0,
      status: {},
    };
    grupo.total += 1;
    grupo.status[status] = (grupo.status[status] || 0) + 1;
    grupos.set(nome, grupo);
  }
  return [...grupos.values()]
    .sort((a, b) => b.total - a.total || comparar(a.responsavel, b.responsavel))
    .slice(0, limite);
}

/* "2026-06-12" (ou timestamp) → "2026-06-12"; inválido → "". */
export function diaDaData(valor) {
  const casamento = /^(\d{4}-\d{2}-\d{2})/.exec(texto(valor));
  return casamento ? casamento[1] : "";
}

/*
  Análises por dia de `data_analise`, em ordem de data. Só os `limite` dias
  mais recentes que têm análise (o gráfico não cabe um ano inteiro).
*/
export function evolucaoDiaria(linhas, limite = 30) {
  const dias = new Map();
  for (const linha of Array.isArray(linhas) ? linhas : []) {
    const dia = diaDaData(linha.data_analise);
    if (dia) dias.set(dia, (dias.get(dia) || 0) + 1);
  }
  return [...dias.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(-limite)
    .map(([dia, total]) => ({ dia, total }));
}

/* "2026-06-12" → "12/06". */
export function rotuloCurtoDoDia(dia) {
  const [, mes, d] = String(dia).split("-");
  return d && mes ? `${d}/${mes}` : String(dia ?? "");
}

/*
  Janela de análise do edital de uma linha: pelo edital e pela unidade (sem
  acento e sem caixa); sem unidade que bata, pelo edital sozinho, desde que só
  haja um cadastro com aquele número na área.
*/
export function janelaDoEdital(editais, linha) {
  const lista = Array.isArray(editais) ? editais : [];
  const edital = normalizar(linha?.edital);
  if (!edital) return null;
  const doEdital = lista.filter((item) => normalizar(item.edital) === edital);
  const unidade = normalizar(linha?.unidade);
  return (
    doEdital.find((item) => normalizar(item.unidade) === unidade) ||
    (doEdital.length === 1 ? doEdital[0] : null)
  );
}

/* 8 anos, 2 meses e 15 dias → "8 anos, 2 meses e 15 dias"; nada → "". */
export function experienciaPorExtenso(anos, meses, dias) {
  const partes = [
    [anos, "ano", "anos"],
    [meses, "mês", "meses"],
    [dias, "dia", "dias"],
  ]
    .filter(([valor]) => valor !== null && valor !== undefined && valor !== "")
    .map(([valor, um, varios]) => {
      const numero = Number(valor);
      return `${numero} ${numero === 1 ? um : varios}`;
    });
  if (!partes.length) return "";
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

/* As colunas do CSV. As de área entram só quando a área usa. */
function colunasDoCsv({ area, comMunicipio }) {
  const colunas = [
    ["Unidade", (l) => l.unidade],
    ["Edital", (l) => l.edital],
    ["Código da vaga", (l) => l.codigo_vaga],
    ["Vaga", (l) => l.nome_vaga],
  ];
  if (comMunicipio)
    colunas.push(["Município", (l) => l.municipio], ["UF", (l) => l.uf]);
  colunas.push(
    ["Candidato", (l) => l.candidato],
    ["Categoria", (l) => l.categoria],
    ["Modalidade", (l) => l.modalidade_concorrencia],
    ["Status", (l) => l.status_consolidado],
    ["Etapa", (l) => l.etapa],
    ["Responsável", (l) => l.responsavel_analise],
    ["Data da análise", (l) => l.data_analise],
    ["Nota final", (l) => l.nota_final_ajustada],
    ["Pontuação escolaridade", (l) => l.pontuacao_escolaridade],
    ["Pontuação cursos", (l) => l.pontuacao_cursos_aperfeicoamento],
    [
      "Pontuação experiência profissional",
      (l) => l.pontuacao_experiencia_profissional,
    ],
  );
  if (area === AREA_SAUDE_INDIGENA)
    colunas.push(
      ["Pontuação critério étnico", (l) => l.pontuacao_criterio_etnico],
      ["Experiência saúde indígena", (l) => l.experiencia_saude_indigena_total],
      ["Experiência atenção básica", (l) => l.experiencia_atencao_basica_total],
    );
  else
    colunas.push(
      ["Experiência (anos)", (l) => l.experiencia_profissional_anos],
      ["Experiência (meses)", (l) => l.experiencia_profissional_meses],
      ["Experiência (dias)", (l) => l.experiencia_profissional_dias],
      ["Experiência total", (l) => l.experiencia_profissional_total],
    );
  colunas.push(
    ["Situação", (l) => (l.ativo === false ? "Inativo" : "Ativo")],
    ["PDF", (l) => l.link_pdf],
  );
  return colunas;
}

/* Número com vírgula decimal (Excel em pt-BR); o resto como texto. */
function celula(valor) {
  if (valor === null || valor === undefined) return '""';
  const bruto =
    typeof valor === "number" ? String(valor).replace(".", ",") : String(valor);
  return `"${sanitizeCsvCell(bruto).replace(/"/g, '""')}"`;
}

/*
  CSV das linhas (já filtradas) com `;` e BOM, para o Excel abrir com acento.
  Célula que começa com =, +, - ou @ ganha um apóstrofo (csv-security.js).
*/
export function gerarCsv(linhas, { area = "", comMunicipio = false } = {}) {
  const colunas = colunasDoCsv({ area, comMunicipio });
  const cabecalho = colunas.map(([rotulo]) => celula(rotulo)).join(";");
  const corpo = (Array.isArray(linhas) ? linhas : []).map((linha) =>
    colunas.map(([, extrair]) => celula(extrair(linha))).join(";"),
  );
  return `\uFEFF${[cabecalho, ...corpo].join("\r\n")}`;
}

/* analises-projetos-2026-09-28.csv */
export function nomeDoCsv(area, hoje = new Date()) {
  const dia = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, "0"),
    String(hoje.getDate()).padStart(2, "0"),
  ].join("-");
  return `analises-${texto(area) || "area"}-${dia}.csv`;
}

/* Só links http(s) viram href: o valor vem da planilha. */
export function linkSeguro(valor) {
  const url = texto(valor);
  return /^https?:\/\//i.test(url) ? url : "";
}

/*
  Regras do painel de seleção (`selecao.html`), sem React e sem banco: o que
  chega de `get_selecao_da_area` (migration 20261001090000_selecao.sql) vira a
  lista de vagas que o painel desenha — filtros, KPIs, o funil, os motivos de
  eliminação, as pendências e o CSV. Nada aqui escreve.

  Cada vaga é uma linha da aba Resultado da planilha "Auditoria". O banco já
  resolve de onde vêm os convocados (`origem_convocados`: "entrevistas" quando
  o edital tem entrevista no MONITORA, "planilha" quando é o dado antigo) e os
  aprovados/contratados (lista de aprovados vigente; nulos sem lista).

  Editais de outras bancas (sem código de vaga) só têm inscritos e total de
  eliminados: os outros campos ficam vazios ("—") e isso não é pendência.
*/
import { sanitizeCsvCell } from "./csv-security.js";
import { dataHoraBR, normalizarBusca } from "./entrevistas-do-painel.js";
import { formatNumberBR } from "./formatters.js";

export { dataHoraBR };

const texto = (valor) => String(valor ?? "").trim();

const inteiro = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
};

export const ORIGENS_DOS_CONVOCADOS = Object.freeze([
  Object.freeze({ id: "entrevistas", rotulo: "Entrevistas do MONITORA" }),
  Object.freeze({ id: "planilha", rotulo: "Planilha (dado antigo)" }),
]);

export const SITUACOES = Object.freeze([
  Object.freeze({ id: "sem_edital", rotulo: "Sem edital cadastrado" }),
  Object.freeze({ id: "sem_lista", rotulo: "Sem lista de aprovados" }),
  Object.freeze({ id: "a_conferir", rotulo: "Números a conferir" }),
  Object.freeze({ id: "outra_banca", rotulo: "Outra banca" }),
]);

export const FILTROS_VAZIOS = Object.freeze({
  busca: "",
  unidade: "",
  edital: "",
  cargo: "",
  origem: "",
  situacao: "",
});

const CAMPOS_NUMERICOS = Object.freeze([
  ["inscritos", "inscritos"],
  ["aptos", "aptos"],
  ["cancelados", "cancelados"],
  ["reprovadosQuestionario", "reprovados_questionario"],
  ["eliminadosNota", "eliminados_nota"],
  ["reprovadosAnalise", "reprovados_analise"],
  ["triados", "triados"],
  ["totalEliminados", "total_eliminados"],
  ["convocados", "convocados"],
  ["aprovados", "aprovados"],
  ["contratados", "contratados"],
  ["naoContratados", "nao_contratados"],
]);

/*
  Números que não fecham: negativo, ou mais eliminados/aptos que inscritos.
  A planilha é conferida à mão; o painel só aponta.
*/
export function numerosAConferir(v) {
  const valores = CAMPOS_NUMERICOS.map(([campo]) => v[campo]).filter(
    (n) => n !== null,
  );
  if (valores.some((n) => n < 0)) return true;
  if (v.inscritos === null) return false;
  return (
    (v.totalEliminados !== null && v.totalEliminados > v.inscritos) ||
    (v.aptos !== null && v.aptos > v.inscritos)
  );
}

function normalizarVaga(bruta) {
  const v = {
    id: texto(bruta?.id),
    edital_id: bruta?.edital_id ?? null,
    edital: texto(bruta?.edital) || texto(bruta?.edital_planilha),
    edital_planilha: texto(bruta?.edital_planilha),
    unidade: texto(bruta?.unidade),
    vaga: texto(bruta?.vaga) || null,
    vagaPlanilha: texto(bruta?.vaga_planilha),
    cargo: texto(bruta?.cargo) || texto(bruta?.vaga_planilha),
    observacao: texto(bruta?.observacao) || null,
    origemConvocados:
      texto(bruta?.origem_convocados) === "entrevistas"
        ? "entrevistas"
        : "planilha",
  };
  for (const [campo, chave] of CAMPOS_NUMERICOS)
    v[campo] = inteiro(bruta?.[chave]);
  v.semEdital = !bruta?.edital_id;
  v.temLista = v.aprovados !== null;
  v.outraBanca = !v.vaga;
  v.aConferir = numerosAConferir(v);
  v.busca = normalizarBusca(
    [v.vaga, v.vagaPlanilha, v.cargo, v.unidade, v.observacao]
      .filter(Boolean)
      .join(" "),
  );
  return v;
}

/** O payload de `get_selecao_da_area` no formato do painel. */
export function normalizarPayload(dados) {
  const carga = dados?.ultima_carga;
  return {
    area: texto(dados?.area),
    geradoEm: dados?.gerado_em || null,
    ultimaCarga: carga
      ? {
          em: carga.em || null,
          linhas: inteiro(carga.linhas),
          semEdital: inteiro(carga.sem_edital),
        }
      : null,
    vagas: (Array.isArray(dados?.vagas) ? dados.vagas : [])
      .map(normalizarVaga)
      .filter((v) => v.id || v.vagaPlanilha),
  };
}

/* ── Filtros ────────────────────────────────────────────────────────── */

export function situacoesDaVaga(v) {
  const lista = [];
  if (v.semEdital) lista.push("sem_edital");
  else if (!v.temLista) lista.push("sem_lista");
  if (v.aConferir) lista.push("a_conferir");
  if (v.outraBanca) lista.push("outra_banca");
  return lista;
}

export function filtrarVagas(vagas, filtros = FILTROS_VAZIOS) {
  const busca = normalizarBusca(filtros.busca);
  return vagas.filter((v) => {
    if (busca && !v.busca.includes(busca)) return false;
    if (filtros.unidade && v.unidade !== filtros.unidade) return false;
    if (filtros.edital && v.edital !== filtros.edital) return false;
    if (filtros.cargo && v.cargo !== filtros.cargo) return false;
    if (filtros.origem && v.origemConvocados !== filtros.origem) return false;
    if (filtros.situacao && !situacoesDaVaga(v).includes(filtros.situacao))
      return false;
    return true;
  });
}

const ordenarPt = (a, b) =>
  a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true });

function valoresDistintos(lista, campo) {
  return [...new Set(lista.map((item) => texto(item[campo])).filter(Boolean))]
    .sort(ordenarPt)
    .map((valor) => ({ valor, rotulo: valor }));
}

export function opcoesDosFiltros(vagas) {
  return {
    unidades: valoresDistintos(vagas, "unidade"),
    editais: valoresDistintos(vagas, "edital"),
    cargos: valoresDistintos(vagas, "cargo"),
    origens: ORIGENS_DOS_CONVOCADOS.map((o) => ({
      valor: o.id,
      rotulo: o.rotulo,
    })),
    situacoes: SITUACOES.map((s) => ({ valor: s.id, rotulo: s.rotulo })),
  };
}

/* ── KPIs ───────────────────────────────────────────────────────────── */

/** Soma de um campo; `null` quando nenhuma vaga tem o número. */
export function somar(vagas, campo) {
  let soma = null;
  for (const v of vagas) if (v[campo] !== null) soma = (soma ?? 0) + v[campo];
  return soma;
}

export function calcularIndicadores(vagas) {
  return {
    vagas: vagas.length,
    editais: new Set(vagas.map((v) => v.edital).filter(Boolean)).size,
    inscritos: somar(vagas, "inscritos"),
    aptos: somar(vagas, "aptos"),
    eliminados: somar(vagas, "totalEliminados"),
    triados: somar(vagas, "triados"),
    convocados: somar(vagas, "convocados"),
    aprovados: somar(vagas, "aprovados"),
    contratados: somar(vagas, "contratados"),
    naoContratados: somar(vagas, "naoContratados"),
  };
}

/** Número inteiro em pt-BR; "—" sem valor. */
export function formatarQuantidade(valor) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor)))
    return "—";
  return formatNumberBR(Number(valor));
}

/* ── Gráficos ───────────────────────────────────────────────────────── */

export const ETAPAS_DO_FUNIL = Object.freeze([
  Object.freeze({ id: "inscritos", rotulo: "Inscritos" }),
  Object.freeze({ id: "aptos", rotulo: "Aptos para análise" }),
  Object.freeze({ id: "triados", rotulo: "Triados" }),
  Object.freeze({ id: "convocados", rotulo: "Convocados p/ entrevista" }),
  Object.freeze({ id: "aprovados", rotulo: "Aprovados" }),
  Object.freeze({ id: "contratados", rotulo: "Contratados" }),
]);

export function funil(vagas) {
  return ETAPAS_DO_FUNIL.map((etapa) => ({
    ...etapa,
    valor: somar(vagas, etapa.id) ?? 0,
  }));
}

export const MOTIVOS_DE_ELIMINACAO = Object.freeze([
  Object.freeze({ id: "cancelados", rotulo: "Cancelados" }),
  Object.freeze({
    id: "reprovadosQuestionario",
    rotulo: "Não finalizaram o questionário",
  }),
  Object.freeze({ id: "eliminadosNota", rotulo: "Eliminados por nota" }),
  Object.freeze({ id: "reprovadosAnalise", rotulo: "Reprovados na análise" }),
]);

export function motivosDeEliminacao(vagas) {
  return MOTIVOS_DE_ELIMINACAO.map((m) => ({
    ...m,
    valor: somar(vagas, m.id) ?? 0,
  }));
}

export function topUnidades(vagas, limite = 10) {
  const soma = new Map();
  for (const v of vagas) {
    const unidade = v.unidade || "Sem unidade";
    soma.set(unidade, (soma.get(unidade) || 0) + (v.inscritos || 0));
  }
  return [...soma]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .filter((u) => u.valor > 0)
    .sort((a, b) => b.valor - a.valor || ordenarPt(a.rotulo, b.rotulo))
    .slice(0, limite);
}

/* ── Pendências ─────────────────────────────────────────────────────── */

export function pendenciasDaSelecao(vagas) {
  return [
    {
      chave: "a_conferir",
      titulo: "Números a conferir",
      subtitulo: "valor negativo, ou mais eliminados/aptos que inscritos",
      unidade: ["vaga", "vagas"],
      valor: vagas.filter((v) => v.aConferir).length,
      severidade: "alta",
    },
    {
      chave: "sem_edital",
      titulo: "Sem edital cadastrado",
      subtitulo: "o edital da planilha não foi encontrado no MONITORA",
      unidade: ["vaga", "vagas"],
      valor: vagas.filter((v) => v.semEdital).length,
      severidade: "media",
    },
    {
      chave: "sem_lista",
      titulo: "Sem lista de aprovados",
      subtitulo: "edital sem lista vigente: aprovados e contratados em branco",
      unidade: ["vaga", "vagas"],
      valor: vagas.filter((v) => !v.semEdital && !v.temLista).length,
      severidade: "baixa",
    },
  ];
}

/* ── Datas e CSV ────────────────────────────────────────────────────── */

export function textoDaUltimaCarga(ultimaCarga) {
  const quando = dataHoraBR(ultimaCarga?.em);
  return quando
    ? `Dados da planilha Auditoria · última carga ${quando}`
    : "Dados da planilha Auditoria · sem carga concluída";
}

export const rotuloDaOrigem = (id) =>
  ORIGENS_DOS_CONVOCADOS.find((o) => o.id === id)?.rotulo || "Planilha";

const numeroDoCsv = (valor) => (valor === null ? "" : String(valor));

const COLUNAS_DO_CSV = Object.freeze([
  ["Edital", (v) => v.edital],
  ["Unidade", (v) => v.unidade],
  ["Vaga", (v) => v.vaga || ""],
  ["Cargo", (v) => v.cargo],
  ["Inscritos", (v) => numeroDoCsv(v.inscritos)],
  ["Aptos para análise", (v) => numeroDoCsv(v.aptos)],
  ["Cancelados", (v) => numeroDoCsv(v.cancelados)],
  [
    "Reprovados por não finalizar o questionário",
    (v) => numeroDoCsv(v.reprovadosQuestionario),
  ],
  ["Eliminados por nota", (v) => numeroDoCsv(v.eliminadosNota)],
  ["Reprovados na análise", (v) => numeroDoCsv(v.reprovadosAnalise)],
  ["Triados", (v) => numeroDoCsv(v.triados)],
  ["Total de eliminados", (v) => numeroDoCsv(v.totalEliminados)],
  ["Convocados para entrevista", (v) => numeroDoCsv(v.convocados)],
  ["Origem dos convocados", (v) => rotuloDaOrigem(v.origemConvocados)],
  ["Aprovados", (v) => numeroDoCsv(v.aprovados)],
  ["Contratados", (v) => numeroDoCsv(v.contratados)],
  ["Não contratados", (v) => numeroDoCsv(v.naoContratados)],
  ["Observação", (v) => v.observacao || ""],
]);

/** CSV com `;` (Excel pt-BR), BOM e células protegidas contra fórmula. */
export function csvDaSelecao(vagas) {
  const celula = (valor) => {
    const seguro = sanitizeCsvCell(valor ?? "");
    return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  const linhas = [
    COLUNAS_DO_CSV.map(([titulo]) => celula(titulo)).join(";"),
    ...vagas.map((v) =>
      COLUNAS_DO_CSV.map(([, valor]) => celula(valor(v))).join(";"),
    ),
  ];
  return `\uFEFF${linhas.join("\r\n")}\r\n`;
}

/* ── Cópia guardada no navegador ────────────────────────────────────── */

/* O tipo de payload para src/lib/cache-de-payload.js (a mesma cópia das Entrevistas). */
export const PAINEL_DE_SELECAO = Object.freeze({
  nome: "painel de seleção",
  chave: ({ area }) => `selecao:${String(area ?? "").trim()}`,
  esquema: (payload) => payload?.schema_version,
  esquemas: Object.freeze([1]),
  valido: (payload) => Array.isArray(payload?.vagas),
});

/* O payload mudou? `gerado_em` muda a cada leitura e não conta. */
export function payloadMudou(anterior, novo) {
  const semData = (payload) => JSON.stringify({ ...payload, gerado_em: null });
  return !anterior || !novo || semData(anterior) !== semData(novo);
}

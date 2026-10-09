/*
  As colunas das tabelas do documento oficial (SEI, Word e a prévia "Como
  fica no SEI"), que o gestor escolhe e ordena por publicação.

  Cada publicação (a chave do modelo de texto: PRELIMINAR_PRELIMINAR,
  FINAL_FINAL_ELIMINADOS…) tem as suas colunas disponíveis — conforme o que
  o retrato da lista traz — e um padrão enxuto:
    listas classificadas  Classificação | Nome | [Modalidade] | Nota
                          (na entrevista e na pré-classificação, sem a
                          modalidade, como nas publicações)
    eliminados            Nome | Nota | Justificativa
  As pontuações parciais da avaliação documental (Formação Acadêmica,
  Cursos de Aperfeiçoamento…) e a Situação do resultado final (dentro das
  vagas ou cadastro reserva) ficam disponíveis, desmarcadas. Classificação,
  Nome e Justificativa são obrigatórias. A convocação para entrevista tem
  colunas fixas (Nº, NOME, Vaga, DATA, HORA).

  Não há coluna de inscrição, CPF ou nascimento: o retrato da lista guarda
  só o nome (exportacao.js) — o documento é público.

  A escolha fica na regra do edital (regra.documento.colunas[chave], a lista
  ordenada dos códigos); sem a chave, o padrão.
*/
import { PARCIAIS_DA_DOCUMENTAL } from "./catalogo.js";

export const COLUNA_DA_ART =
  "Nota da Autodeclaração de Requisitos e Títulos (ART)";

const PREFIXO_DA_PARCIAL = "PARCIAL_";
const OBRIGATORIAS = new Set(["CLASSIFICACAO", "NOME", "JUSTIFICATIVA"]);
const NO_FIM = new Set(["JUSTIFICATIVA"]);
const SEM_MODALIDADE_NO_PADRAO = new Set(["ENTREVISTA", "PROVISORIA", "LOTE"]);

/** "PARCIAL_FORMACAO" ← "FORMACAO". */
export const colunaDaParcial = (codigo) => `${PREFIXO_DA_PARCIAL}${codigo}`;

/** "FORMACAO" ← "PARCIAL_FORMACAO" (ou null). */
export const parcialDaColuna = (id) =>
  String(id).startsWith(PREFIXO_DA_PARCIAL)
    ? String(id).slice(PREFIXO_DA_PARCIAL.length)
    : null;

export const rotuloDaParcial = (codigo) =>
  PARCIAIS_DA_DOCUMENTAL.find(([v]) => v === codigo)?.[1] || codigo;

/** O tipo de lista e se é a dos eliminados, a partir da chave do modelo. */
function partesDaChave(chave) {
  const texto = String(chave || "");
  return {
    tipo: texto.split("_")[0],
    eliminados: texto.endsWith("_ELIMINADOS"),
  };
}

/** As colunas padrão de uma publicação (chave do modelo); null = fixas. */
export function colunasPadrao(chave) {
  const { tipo, eliminados } = partesDaChave(chave);
  if (tipo === "CONVOCACAO") return null;
  if (eliminados) return ["NOME", "NOTA", "JUSTIFICATIVA"];
  return SEM_MODALIDADE_NO_PADRAO.has(tipo)
    ? ["CLASSIFICACAO", "NOME", "NOTA"]
    : ["CLASSIFICACAO", "NOME", "MODALIDADE", "NOTA"];
}

/** O rótulo de uma coluna no documento, no padrão de cada publicação. */
export function rotuloDaColuna(id, tipo, eliminados = false) {
  const parcial = parcialDaColuna(id);
  if (parcial) return rotuloDaParcial(parcial);
  const caixaAlta = tipo === "FINAL" && !eliminados;
  switch (id) {
    case "CLASSIFICACAO":
      return caixaAlta ? "CLASSIFICAÇÃO" : "Classificação";
    case "NOME":
      return !eliminados && (tipo === "FINAL" || tipo === "ENTREVISTA")
        ? "NOME"
        : "Nome";
    case "MODALIDADE":
      return caixaAlta ? "MODALIDADE" : "Modalidade de Concorrência";
    case "NOTA":
      if (eliminados) return tipo === "ENTREVISTA" ? "Nota" : "Nota Final";
      if (tipo === "PROVISORIA" || tipo === "LOTE") return COLUNA_DA_ART;
      if (tipo === "ENTREVISTA") return "NOTA";
      return caixaAlta ? "NOTA FINAL" : "Nota Final";
    case "SITUACAO":
      return caixaAlta ? "SITUAÇÃO" : "Situação";
    case "JUSTIFICATIVA":
      return "Justificativa";
    default:
      return id;
  }
}

/* A explicação curta que a tela mostra ao lado de cada coluna. */
const AJUDA = Object.freeze({
  MODALIDADE: "Só na tabela da classificação geral, com as modalidades.",
  SITUACAO: "Dentro das vagas ou cadastro reserva.",
});

/**
 * As colunas que esta lista registrada pode mostrar, na ordem natural:
 * [{ id, rotulo, obrigatoria, ajuda }]. null = colunas fixas (convocação).
 *   retrato  o retrato da lista (exportacao.js)
 *   lista    "todas" | "geral" | código da modalidade | "eliminados"
 */
export function colunasDisponiveis(retrato, lista = "todas") {
  const tipo = retrato?.tipo;
  if (!tipo || tipo === "CONVOCACAO") return null;
  const eliminados = lista === "eliminados";
  const parciais = tipo === "PRELIMINAR" ? retrato.parciais || [] : [];
  const modalidades = retrato.modalidades || [];
  let ids;
  if (eliminados) {
    const comNota = (retrato.vagas || []).some((v) =>
      (v.eliminados || []).some((e) => e.nota !== undefined),
    );
    ids = [
      "NOME",
      ...(comNota ? ["NOTA", ...parciais.map(colunaDaParcial)] : []),
      "JUSTIFICATIVA",
    ];
  } else {
    ids = [
      "CLASSIFICACAO",
      "NOME",
      ...(lista === "todas" && modalidades.length ? ["MODALIDADE"] : []),
      "NOTA",
      ...(tipo === "FINAL" ? ["SITUACAO"] : []),
      ...parciais.map(colunaDaParcial),
    ];
  }
  return ids.map((id) => ({
    id,
    rotulo: rotuloDaColuna(id, tipo, eliminados),
    obrigatoria: OBRIGATORIAS.has(id),
    ajuda: AJUDA[id] || "",
  }));
}

/**
 * As colunas que vão para o documento, na ordem: as guardadas (ou as do
 * padrão) que esta lista tem, com as obrigatórias sempre presentes.
 *   disponiveis  ids (ou o retorno de colunasDisponiveis)
 *   guardadas    regra.documento.colunas[chave] (ou undefined)
 */
export function colunasEscolhidas(disponiveis, guardadas, chave) {
  const ids = (disponiveis || []).map((c) =>
    typeof c === "string" ? c : c.id,
  );
  const base = Array.isArray(guardadas)
    ? guardadas
    : colunasPadrao(chave) || [];
  const escolhidas = [...new Set(base)].filter((id) => ids.includes(id));
  const faltando = ids.filter(
    (id) => OBRIGATORIAS.has(id) && !escolhidas.includes(id),
  );
  return [
    ...faltando.filter((id) => !NO_FIM.has(id)),
    ...escolhidas,
    ...faltando.filter((id) => NO_FIM.has(id)),
  ];
}

/**
 * O que guardar depois de mudar as colunas numa lista: as escolhidas aqui,
 * mais as que esta lista não tem (ex.: a Modalidade, ao editar a lista só da
 * classificação geral), cada uma depois da coluna que a antecedia — para a
 * escolha valer também nas outras listas da mesma publicação.
 */
export function colunasParaGuardar(escolhidas, disponiveis, anteriores, chave) {
  const ids = (disponiveis || []).map((c) =>
    typeof c === "string" ? c : c.id,
  );
  const base = Array.isArray(anteriores)
    ? anteriores
    : colunasPadrao(chave) || [];
  const resultado = [...escolhidas];
  base.forEach((id, i) => {
    if (ids.includes(id) || resultado.includes(id)) return;
    const antes = base
      .slice(0, i)
      .reverse()
      .find((x) => resultado.includes(x));
    resultado.splice(antes ? resultado.indexOf(antes) + 1 : 0, 0, id);
  });
  return resultado;
}

/** As colunas guardadas iguais ao padrão da publicação (não precisam ir à regra). */
export function ehOPadrao(colunas, chave) {
  const padrao = colunasPadrao(chave);
  return (
    !Array.isArray(colunas) ||
    (Array.isArray(padrao) &&
      colunas.length === padrao.length &&
      colunas.every((id, i) => id === padrao[i]))
  );
}

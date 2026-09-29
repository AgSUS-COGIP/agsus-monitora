/*
  Modelos de resposta a recurso, sem DOM: os marcadores aceitos, o
  preenchimento do texto com os dados do recurso, a escolha dos modelos que
  valem para um recurso e a validação do formulário de modelo.

  Os marcadores são os de private."FC_MARCADORES_MODELO_RESPOSTA"()
  (supabase/migrations/20260929230000_recursos_modelos_anexos_respostas.sql):
  o banco recusa modelo com marcador fora desta lista, e
  tests/modelos-de-resposta.test.js confere que as duas listas são iguais.

  O texto é texto puro. `renderizarModelo` só troca `{marcador}` pelo valor,
  numa passada: um valor que traga `{outro}` ou `<b>` fica como está, sem
  virar marcador nem HTML. Quem desenha (a gaveta, a página de impressão, o
  .docx) põe o texto como texto — nada de innerHTML.
*/
import { formatNumberBR } from "./formatters.js";
import { rotuloDaOrigem } from "./recursos-dos-candidatos.js";

export const MARCADORES = Object.freeze([
  Object.freeze({ chave: "nome_candidato", rotulo: "Nome do candidato" }),
  Object.freeze({ chave: "codigo_candidato", rotulo: "Código do candidato" }),
  Object.freeze({ chave: "edital", rotulo: "Edital" }),
  Object.freeze({ chave: "unidade", rotulo: "Unidade" }),
  Object.freeze({ chave: "cargo", rotulo: "Cargo" }),
  Object.freeze({ chave: "vaga", rotulo: "Vaga" }),
  Object.freeze({ chave: "origem", rotulo: "Origem do recurso" }),
  Object.freeze({ chave: "nota_anterior", rotulo: "Nota no cadastro" }),
  Object.freeze({ chave: "nota_atual", rotulo: "Nota atual" }),
  Object.freeze({
    chave: "resultado_anterior",
    rotulo: "Resultado no cadastro",
  }),
  Object.freeze({ chave: "resultado_atual", rotulo: "Resultado atual" }),
  Object.freeze({ chave: "data_hoje", rotulo: "Data de hoje" }),
  Object.freeze({ chave: "analista", rotulo: "Analista" }),
  Object.freeze({ chave: "fundamentacao", rotulo: "Fundamentação" }),
]);

export const CHAVES_DOS_MARCADORES = Object.freeze(
  MARCADORES.map((m) => m.chave),
);

const PADRAO_DO_MARCADOR = /\{([a-z_]+)\}/g;
const texto = (valor) => String(valor ?? "").trim();

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "29 de setembro de 2026" (data local de quem usa). */
export function dataPorExtenso(data = new Date()) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const notaEmTexto = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? ""
    : Number.isFinite(Number(valor))
      ? formatNumberBR(Number(valor), { maximumFractionDigits: 2 })
      : texto(valor);

/** Os marcadores citados no texto, sem repetir, na ordem em que aparecem. */
export function marcadoresDoTexto(corpo) {
  return [
    ...new Set(
      [...String(corpo ?? "").matchAll(PADRAO_DO_MARCADOR)].map((m) => m[1]),
    ),
  ];
}

/** Marcadores do texto que não estão na lista aceita. */
export function marcadoresDesconhecidos(corpo) {
  return marcadoresDoTexto(corpo).filter(
    (chave) => !CHAVES_DOS_MARCADORES.includes(chave),
  );
}

/**
 * Os valores dos marcadores para um recurso (como a aba o recebe de
 * `get_recursos_da_area`). Vazio = não informado.
 */
export function valoresDoRecurso(
  recurso,
  { origens, fundamentacao = "", analista = "", hoje = new Date() } = {},
) {
  const r = recurso || {};
  return {
    nome_candidato: texto(r.candidato),
    codigo_candidato: texto(r.codigo),
    edital: texto(r.edital),
    unidade: texto(r.unidade),
    cargo: texto(r.cargo),
    vaga: texto(r.vaga),
    origem: r.origem ? rotuloDaOrigem(r.origem, origens) : "",
    nota_anterior: notaEmTexto(r.nota_anterior),
    nota_atual: notaEmTexto(r.nota_atual),
    resultado_anterior: texto(r.resultado_anterior),
    resultado_atual: texto(r.resultado_atual),
    data_hoje: dataPorExtenso(hoje),
    analista: texto(r.analista) || texto(analista),
    fundamentacao: texto(fundamentacao),
  };
}

/** O que fica no lugar de um marcador sem valor: visível para quem revisa. */
export const marcaDeFaltando = (chave) =>
  `[não informado: ${MARCADORES.find((m) => m.chave === chave)?.rotulo || chave}]`;

/**
 * Preenche o modelo. Devolve o texto, os marcadores sem valor (`faltando`,
 * que ficam como "[não informado: …]") e os desconhecidos (ficam como
 * estão). Uma passada só: o valor inserido não é relido.
 */
export function renderizarModelo(corpo, valores = {}) {
  const faltando = new Set();
  const desconhecidos = new Set();
  const resultado = String(corpo ?? "").replace(
    PADRAO_DO_MARCADOR,
    (inteiro, chave) => {
      if (!CHAVES_DOS_MARCADORES.includes(chave)) {
        desconhecidos.add(chave);
        return inteiro;
      }
      const valor = texto(valores[chave]);
      if (!valor) {
        faltando.add(chave);
        return marcaDeFaltando(chave);
      }
      return valor;
    },
  );
  return {
    texto: resultado.replace(/\r\n?/g, "\n"),
    faltando: [...faltando],
    desconhecidos: [...desconhecidos],
  };
}

/*
  Os modelos que servem para o recurso: da área (ou de todas), da origem (ou
  de todas) e, com o recurso decidido, da situação dele. Em análise, todos os
  da área e da origem (a aprovação exige a decisão). Primeiro os da origem
  exata e da situação do recurso, depois pelo nome.
*/
export function modelosAplicaveis(modelos, recurso, area) {
  const situacao = recurso?.situacao || "EM_ANALISE";
  const decidido = situacao !== "EM_ANALISE";
  return (Array.isArray(modelos) ? modelos : [])
    .filter(
      (m) =>
        (!m.area || m.area === area) &&
        (!m.origem || m.origem === recurso?.origem) &&
        (!decidido || m.situacao === situacao),
    )
    .sort(
      (a, b) =>
        Number(Boolean(b.origem)) - Number(Boolean(a.origem)) ||
        Number(b.situacao === situacao) - Number(a.situacao === situacao) ||
        String(a.nome).localeCompare(String(b.nome), "pt-BR"),
    );
}

/* ── Formulário de modelo (administração) ─────────────────────────────── */

export const MODELO_VAZIO = Object.freeze({
  id: null,
  versao: null,
  nome: "",
  situacao: "DEFERIDO",
  origem: "",
  area: "",
  corpo: "",
});

export function rascunhoDoModelo(modelo) {
  if (!modelo) return { ...MODELO_VAZIO };
  return {
    id: modelo.id,
    versao: modelo.versao,
    nome: modelo.nome || "",
    situacao: modelo.situacao || "DEFERIDO",
    origem: modelo.origem || "",
    area: modelo.area || "",
    corpo: modelo.corpo || "",
  };
}

/** Erros do formulário de modelo, por campo (vazio = pode salvar). */
export function errosDoModelo(rascunho) {
  const erros = {};
  const nome = texto(rascunho?.nome);
  const corpo = texto(rascunho?.corpo);
  if (nome.length < 3 || nome.length > 150)
    erros.nome = "Informe o nome do modelo (3 a 150 caracteres).";
  if (
    !["DEFERIDO", "INDEFERIDO", "PARCIALMENTE_INDEFERIDO"].includes(
      rascunho?.situacao,
    )
  )
    erros.situacao = "Escolha a situação.";
  if (corpo.length < 20 || corpo.length > 20000)
    erros.corpo = "O texto deve ter de 20 a 20.000 caracteres.";
  else {
    const desconhecidos = marcadoresDesconhecidos(corpo);
    if (desconhecidos.length)
      erros.corpo = `Marcador desconhecido: ${desconhecidos.map((c) => `{${c}}`).join(", ")}.`;
  }
  return erros;
}

/** O `p_dados` de `salvar_modelo_resposta_recurso`. */
export function dadosDoModelo(rascunho) {
  return {
    ...(rascunho.id ? { id: rascunho.id, versao: rascunho.versao } : {}),
    nome: texto(rascunho.nome),
    situacao: rascunho.situacao,
    origem: rascunho.origem || null,
    area: rascunho.area || null,
    corpo: texto(rascunho.corpo),
  };
}

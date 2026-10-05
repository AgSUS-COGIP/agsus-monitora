/*
  O documento da carta de convocação, no modelo das publicações da AgSUS no
  SEI — reaproveitando o documento oficial da Classificação:

    - `htmlParaSei`: o HTML para colar no editor do SEI, com as classes de
      estilo dele (Texto_Alinhado_Direita, Texto_Centralizado_Maiusculas,
      Texto_Justificado_Recuo_Primeira_Linha); várias cartas vão separadas por
      quebra de página do editor;
    - `textoParaSei`: o mesmo em texto puro;
    - `paginaDaPrevia`: a página "Como fica no SEI" (timbrado simulado) — a
      prévia na tela e a impressão (PDF), uma carta por página
      (paginaNoModeloDoSei, de classificacao/documento-sei.js);
    - `gerarDocxDasCartas`: o .docx com papel timbrado (pacoteDocx, de
      classificacao/documento-docx.js), uma carta por página; e
      `gerarZipDasCartas`, um .docx por candidato num .zip.

    [timbrado: logo + nome e endereço da agência]        ← o SEI põe
    Brasília, na data da assinatura digital.            (à direita)
    TÍTULO EM CAIXA ALTA                                 (centralizado)
    Parágrafos com recuo na primeira linha; documentos em itens.
    [assinatura eletrônica]                              ← o SEI põe

  `montarCartas` preenche o modelo para cada candidato (carta-de-convocacao.js).
*/

import {
  LOCAL_PADRAO,
  htmlDoTrecho,
  paginaNoModeloDoSei,
  trechos,
} from "./classificacao/documento-sei.js";
import {
  arquivosDoDocx,
  corridas,
  documentoComPartes,
  pacoteDocx,
  QUEBRA_DE_PAGINA,
} from "./classificacao/documento-docx.js";
import { zipSemCompressao } from "./documento-da-resposta.js";
import { hojeEmBrasilia, preencherCarta } from "./carta-de-convocacao.js";
import { dataPorExtenso } from "./classificacao/documento-sei.js";

const texto = (valor) => String(valor ?? "").trim();

const escapar = (valor) =>
  String(valor ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const semMarcas = (valor) =>
  trechos(valor)
    .map((t) => t.texto)
    .join("");

/**
 * As cartas de uma emissão.
 *   modelo      { nome, versao, vigente: { titulo, texto } }
 *   candidatos  as linhas da lista de aprovados, na ordem do documento
 *   emissao     { dataLimite, local, documentos, contato }
 *   hoje        "AAAA-MM-DD" (data da emissão)
 */
export function montarCartas({
  modelo,
  candidatos = [],
  emissao = {},
  hoje = hojeEmBrasilia(),
  cidade = LOCAL_PADRAO,
} = {}) {
  const vigente = modelo?.vigente || {};
  const cartas = candidatos.map((candidato) => {
    const carta = preencherCarta(vigente, candidato, {
      ...emissao,
      data: hoje,
    });
    return {
      candidatoId: String(candidato.candidato_id ?? ""),
      nome: texto(candidato.nome),
      titulo: carta.titulo,
      blocos: carta.blocos,
      faltando: carta.faltando,
    };
  });
  const titulo = semMarcas(
    cartas[0]?.titulo || vigente.titulo || "Carta de convocação",
  );
  return {
    nome:
      cartas.length === 1
        ? `${tituloEmFrase(titulo)} - ${cartas[0].nome}`
        : `${tituloEmFrase(titulo)} - ${cartas.length} candidatos`,
    modelo: texto(modelo?.nome),
    versao: Number(modelo?.versao) || 0,
    localData: `${cidade}, na data da assinatura digital.`,
    localDataPorExtenso: `${cidade}, ${dataPorExtenso(hoje)}.`,
    cartas,
  };
}

/* "CARTA DE CONVOCAÇÃO" → "Carta de convocação" (nome do arquivo e da aba). */
function tituloEmFrase(valor) {
  const t = texto(valor).toLocaleLowerCase("pt-BR");
  return t ? t[0].toLocaleUpperCase("pt-BR") + t.slice(1) : "Carta";
}

/** Um documento com uma carta só (a de índice `i`), para "uma por candidato". */
export function soACarta(doc, i) {
  const carta = doc.cartas[i];
  if (!carta) return null;
  return {
    ...doc,
    nome: `${tituloEmFrase(semMarcas(carta.titulo))} - ${carta.nome}`,
    cartas: [carta],
  };
}

/* ── HTML e texto para o SEI ─────────────────────────────────────────── */

/* A quebra de página do editor do SEI (CKEditor). */
const QUEBRA_DO_SEI =
  '<div style="page-break-after: always"><span style="display: none;">&nbsp;</span></div>';

function htmlDaCarta(doc, carta) {
  const partes = [
    `<p class="Texto_Alinhado_Direita">${escapar(doc.localData)}</p>`,
    `<p class="Texto_Centralizado_Maiusculas">${htmlDoTrecho(carta.titulo)}</p>`,
  ];
  for (const bloco of carta.blocos)
    partes.push(
      bloco.tipo === "item"
        ? `<p class="Texto_Justificado">&bull; ${htmlDoTrecho(bloco.texto)}</p>`
        : `<p class="Texto_Justificado_Recuo_Primeira_Linha">${htmlDoTrecho(bloco.texto)}</p>`,
    );
  return partes.join("\n");
}

/** O HTML para colar no editor do SEI (sem timbrado, assinatura e rodapé). */
export function htmlParaSei(doc) {
  return doc.cartas
    .map((carta) => htmlDaCarta(doc, carta))
    .join(`\n${QUEBRA_DO_SEI}\n`);
}

/** As cartas em texto puro, separadas por uma linha de traços. */
export function textoParaSei(doc) {
  return doc.cartas
    .map((carta) =>
      [
        doc.localData,
        "",
        semMarcas(carta.titulo).toLocaleUpperCase("pt-BR"),
        "",
        ...carta.blocos.map((b) =>
          b.tipo === "item" ? `• ${semMarcas(b.texto)}` : semMarcas(b.texto),
        ),
      ].join("\n"),
    )
    .join("\n\n----------------------------------------\n\n");
}

/**
 * A página "Como fica no SEI" das cartas (prévia e impressão), uma por página.
 * `marca`: { cabecalho, logo } (Configurações › Marca).
 */
export function paginaDaPrevia(doc, marca = {}) {
  const corpoHtml = doc.cartas
    .map(
      (carta, i) =>
        `<section class="carta${i ? " quebra-de-pagina" : ""}" data-carta="${i + 1}">${htmlDaCarta(doc, carta)}</section>`,
    )
    .join("");
  return paginaNoModeloDoSei(
    {
      nome: doc.nome,
      corpoHtml,
      aviso: "Assinatura eletrônica: posta pelo SEI.",
    },
    marca,
  );
}

/* ── DOCX ────────────────────────────────────────────────────────────── */

const RECUO = 1418; // 25 mm, como no SEI

function paragrafoXml(
  conteudo,
  { alinhamento = "both", recuo = 0, antes = 0, depois = 120 } = {},
) {
  return (
    `<w:p><w:pPr><w:spacing w:before="${antes}" w:after="${depois}"/>` +
    `${recuo ? `<w:ind w:firstLine="${recuo}"/>` : ""}<w:jc w:val="${alinhamento}"/></w:pPr>${conteudo}</w:p>`
  );
}

function partesDaCarta(doc, carta) {
  return [
    paragrafoXml(corridas(doc.localDataPorExtenso), {
      alinhamento: "right",
      depois: 240,
    }),
    paragrafoXml(corridas(carta.titulo, { tamanho: 26, caixaAlta: true }), {
      alinhamento: "center",
      depois: 240,
    }),
    ...carta.blocos.map((bloco) =>
      bloco.tipo === "item"
        ? paragrafoXml(corridas(`• ${bloco.texto}`), { depois: 60 })
        : paragrafoXml(corridas(bloco.texto), { recuo: RECUO }),
    ),
  ];
}

/** O word/document.xml das cartas, uma por página. */
export function corpoDasCartasXml(doc) {
  const partes = [];
  doc.cartas.forEach((carta, i) => {
    if (i) partes.push(QUEBRA_DE_PAGINA);
    partes.push(...partesDaCarta(doc, carta));
  });
  return documentoComPartes(partes);
}

/** Os bytes do .docx com todas as cartas (papel timbrado). */
export function gerarDocxDasCartas(doc, opcoes = {}) {
  return pacoteDocx(
    { nome: doc.nome, documento: corpoDasCartasXml(doc) },
    opcoes,
  );
}

/** Nome de arquivo seguro: sem acento, barra nem símbolo. */
export function nomeDeArquivo(valor) {
  return (
    texto(valor)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s.-]+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "carta-de-convocacao"
  );
}

/** Um .docx por candidato, num .zip ("01 - Nome.docx"). */
export function gerarZipDasCartas(doc, opcoes = {}) {
  const quando = opcoes.quando || new Date();
  const largura = String(doc.cartas.length).length;
  const arquivos = doc.cartas.map((carta, i) => {
    const uma = soACarta(doc, i);
    const bytes = zipSemCompressao(
      arquivosDoDocx(
        { nome: uma.nome, documento: corpoDasCartasXml(uma) },
        { ...opcoes, quando },
      ),
      quando,
    );
    return {
      nome: `${String(i + 1).padStart(Math.max(2, largura), "0")} - ${nomeDeArquivo(carta.nome)}.docx`,
      conteudo: bytes,
    };
  });
  return zipSemCompressao(arquivos, quando);
}

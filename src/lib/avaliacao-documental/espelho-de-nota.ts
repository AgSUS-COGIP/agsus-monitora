/*
  O ESPELHO DE NOTA do candidato (modelo "Template_Espelho_de_Nota_Layout_
  Candidato"): um documento simplificado para o atendimento ao candidato, feito
  a partir da ficha concluída da Avaliação documental. Sem DOM e sem banco: a
  ficha já carregada (estado-da-ficha.js) entra, uma página HTML A4 sai; o
  navegador imprime ("Salvar como PDF") e nada fica guardado (nem no Storage).

  Dois modelos, escolhidos pelo resultado gravado da ficha:
  - ELIMINADO (Inapto por requisito): sem pontos e sem a nota declarada
    (pedido da COREs em 14/10): nas notas, só a consolidada, "Não se aplica".
    Justificativa: os motivos da eliminação
    com o item do edital (motivosDoResultado, o mesmo texto da lateral da
    ficha), inclusive o "Outro motivo" descrito.
  - COM_PONTOS (Apto ou Inapto pela nota mínima): notas, a pontuação por
    critério (declarada × após a análise × teto, com a justificativa de cada
    critério: os motivos e justificativas da conta, textosDasJustificativas) e
    as observações registradas (as do parecer que não couberam num critério:
    a Observação do avaliador de cada item, as prontas e a geral).
  Os textos vêm da mesma conta do parecer (pontuacao.js), para não divergir.
  Nada interno: nem avaliador, nem CPF, nem o questionário.
*/
import { PARCIAL_DO_TIPO } from "./catalogo.js";
import { composicaoDaNota } from "./ficha.js";
import { motivosDoResultado } from "./motivos-do-resultado.ts";
import { numeroDoParecer, textosDasJustificativas } from "./pontuacao.js";
import { CABECALHO_PADRAO } from "../cabecalho-dos-documentos.js";

export type ModeloDoEspelho = "ELIMINADO" | "COM_PONTOS";

type BlocoDaRegra = {
  codigo: string;
  tipo: string;
  titulo?: string;
  item_edital?: string;
  [chave: string]: unknown;
};
type RegraDoEspelho = {
  blocos: BlocoDaRegra[];
  casas_parecer?: number;
  corte?: { item_edital?: string };
  [chave: string]: unknown;
};
type AvaliacaoDoEspelho = {
  resultado?: string;
  nota_apurada?: number;
  nota_final?: number;
  nota_minima?: number | null;
  parciais?: Record<string, number | undefined>;
  eliminatorios?: string[];
  observacoes?: string[];
  blocos?: {
    codigo: string;
    situacao: string;
    efeito: string | null;
    /** codigo null = o motivo escrito pelo avaliador (Outro motivo): sem o item do edital. */
    motivos: { codigo?: string | null; texto: string; item_edital?: string }[];
  }[];
  experiencia?: unknown;
};
type LancamentoDoEspelho = {
  nivel?: string;
  blocos?: Record<string, unknown>;
  [chave: string]: unknown;
};

export type EntradaDoEspelho = {
  /** A regra da vaga (a diferença do cargo por cima do nível). */
  regra: RegraDoEspelho;
  lancamento: LancamentoDoEspelho;
  /** A conta da ficha (calcularFicha / calcularAvaliacao). */
  avaliacao: AvaliacaoDoEspelho;
  /** A nota declarada pelo questionário, por critério (declaradaDaFicha). */
  declarada?: {
    total?: number;
    parciais?: Record<string, number | undefined>;
  } | null;
  /** O resultado gravado da ficha (tp_resultado). */
  resultado: string;
  /** A nota final gravada (nota_final); sem ela, a da conta. */
  notaFinal?: number | null;
  /** A nota autodeclarada na Empregare (ART); sem ela, a declarada pelo questionário. */
  notaAutodeclarada?: number | null;
  candidato: {
    nome?: string | null;
    codigo?: string | number | null;
    modalidade?: string | null;
  };
  vaga: {
    codigo?: string | null;
    cargo?: string | null;
    regime?: string | null;
    cargaHoraria?: string | number | null;
  };
  edital: { rotulo?: string | null; unidade?: string | null };
};

export type LinhaDoEspelho = { rotulo: string; valor: string };
export type CriterioDoEspelho = {
  rotulo: string;
  declarada: string;
  apurada: string;
  teto: string;
  justificativas: string[];
};
export type Espelho = {
  modelo: ModeloDoEspelho;
  titulo: string;
  candidato: string;
  dados: LinhaDoEspelho[];
  notas: LinhaDoEspelho[];
  criterios: CriterioDoEspelho[];
  justificativas: string[];
  nomeDoArquivo: string;
};

export const TITULO_DO_ESPELHO = "Espelho de Pontuação da Análise Curricular";
export const SUBTITULO_DO_ESPELHO =
  "Documento simplificado para atendimento ao candidato";
export const NAO_SE_APLICA_NO_ELIMINADO =
  "Não se aplica — candidato(a) eliminado(a) na análise documental";
export const RODAPE_DO_ESPELHO =
  "Observação: este espelho apresenta exclusivamente os dados necessários para comunicação da nota ao candidato, sem reprodução integral do questionário ou de informações internas adicionais.";
export const SEM_OBSERVACAO = "Sem observação registrada.";

const MODALIDADES: Readonly<Record<string, string>> = {
  AC: "Ampla concorrência",
  PCD: "Pessoas com deficiência",
  PP: "Pretos e pardos",
  PI: "Indígenas",
  PQ: "Quilombolas",
  TRANS: "Pessoas trans",
};

const SITUACOES: Readonly<Record<string, string>> = {
  APTO: "Apto(a)",
  INAPTO_REQUISITO: "Eliminado(a) — não atendeu a requisito do edital",
  INAPTO_NOTA: "Não classificado(a) — nota abaixo da mínima",
};

const texto = (v: unknown) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
const ehNumero = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** O modelo pelo resultado da ficha: só o Inapto por requisito é eliminado (sem pontos). */
export function modeloDoEspelho(
  resultado: string | null | undefined,
): ModeloDoEspelho {
  return resultado === "INAPTO_REQUISITO" ? "ELIMINADO" : "COM_PONTOS";
}

function rotuloDaModalidade(modalidade: unknown) {
  const t = texto(modalidade);
  return MODALIDADES[t.toUpperCase()] ?? t;
}

/* "Item 8.2.6: texto" (o formato do parecer) para comparar sem pontuação final. */
const comparavel = (t: string) =>
  texto(t)
    .toLowerCase()
    .replace(/[.;:]+$/, "");

/** As justificativas de um critério que pontua: motivos da conta e justificativas do ajuste. */
function justificativasDoCriterio(
  regra: RegraDoEspelho,
  bloco: BlocoDaRegra,
  lancamento: LancamentoDoEspelho,
  avaliacao: AvaliacaoDoEspelho,
): string[] {
  const avaliado = (avaliacao.blocos ?? []).find(
    (b) => b.codigo === bloco.codigo,
  );
  const textos: string[] = [];
  for (const m of avaliado?.motivos ?? []) {
    // O Outro motivo (codigo null) vai como o avaliador escreveu, sem o item (#466).
    const item = m.codigo === null ? "" : m.item_edital || bloco.item_edital;
    textos.push(item ? `Item ${item}: ${m.texto}` : m.texto);
  }
  const lancado = lancamento.blocos?.[bloco.codigo];
  for (const t of textosDasJustificativas(regra, bloco, lancado) as string[])
    if (!textos.includes(t)) textos.push(t);
  return textos.map(texto).filter(Boolean);
}

/** Monta o espelho (os dados de cada quadro, já em texto). */
export function montarEspelho(entrada: EntradaDoEspelho): Espelho {
  const { regra, lancamento, avaliacao, declarada, resultado } = entrada;
  const modelo = modeloDoEspelho(resultado);
  const casas = ehNumero(regra.casas_parecer) ? regra.casas_parecer : 1;
  const numero = (v: unknown) =>
    ehNumero(v) ? (numeroDoParecer(v, casas) as string) : "—";

  const nome = texto(entrada.candidato.nome) || "candidato(a)";
  const codigo = texto(entrada.candidato.codigo);
  const edital = [
    texto(entrada.edital.rotulo)
      ? /^edital/i.test(texto(entrada.edital.rotulo))
        ? texto(entrada.edital.rotulo)
        : `Edital ${texto(entrada.edital.rotulo)}`
      : "",
    texto(entrada.edital.unidade),
  ]
    .filter(Boolean)
    .join(" — ");
  const vaga = [texto(entrada.vaga.codigo), texto(entrada.vaga.cargo)]
    .filter(Boolean)
    .join(" - ");
  const regime = texto(entrada.vaga.regime);
  const carga = texto(entrada.vaga.cargaHoraria);
  // Sem regime e sem carga horária no banco, a linha sai (nada de "- .").
  const descricao = [
    regime,
    carga ? `${carga}${/^\d+$/.test(carga) ? " horas" : ""} semanais` : "",
  ]
    .filter(Boolean)
    .join(" / ");

  const dados: LinhaDoEspelho[] = [
    { rotulo: "Edital", valor: edital },
    { rotulo: "Candidato(a)", valor: texto(entrada.candidato.nome) },
    { rotulo: "Código do candidato", valor: codigo },
    {
      rotulo: "Modalidade de concorrência",
      valor: rotuloDaModalidade(entrada.candidato.modalidade),
    },
    { rotulo: "Vaga", valor: vaga },
    ...(descricao ? [{ rotulo: "Descrição", valor: descricao }] : []),
    { rotulo: "Etapa", valor: "Análise Curricular" },
    { rotulo: "Situação", valor: SITUACOES[resultado] ?? texto(resultado) },
  ].filter((l) => l.valor);

  const autodeclarada = ehNumero(entrada.notaAutodeclarada)
    ? entrada.notaAutodeclarada
    : declarada?.total;
  const notaFinal = ehNumero(entrada.notaFinal)
    ? entrada.notaFinal
    : avaliacao.nota_final;
  // O eliminado no requisito não mostra a nota declarada: só "Não se aplica".
  const notas: LinhaDoEspelho[] =
    modelo === "ELIMINADO"
      ? [
          {
            rotulo: "Nota consolidada (após a análise documental)",
            valor: NAO_SE_APLICA_NO_ELIMINADO,
          },
        ]
      : [
          {
            rotulo: "Nota autodeclarada (antes da análise)",
            valor: numero(autodeclarada),
          },
          {
            rotulo: "Nota consolidada (após a análise documental)",
            valor: numero(notaFinal),
          },
        ];

  const criterios: CriterioDoEspelho[] = [];
  let justificativas: string[];
  if (modelo === "ELIMINADO") {
    // O mesmo texto da lateral da ficha: "Bloco: motivo — item X".
    justificativas = motivosDoResultado(
      regra.blocos as Parameters<typeof motivosDoResultado>[0],
      lancamento,
      avaliacao as Parameters<typeof motivosDoResultado>[2],
      resultado,
    ).map((m) => texto(m.texto));
  } else {
    const partes = composicaoDaNota(
      regra,
      lancamento,
      avaliacao,
      declarada,
    ) as {
      bloco: string;
      parcial: string;
      rotulo: string;
      apurado: number | null;
      declarado: number | null;
      teto: number | null;
    }[];
    const usados = new Set<string>();
    for (const parte of partes) {
      const bloco = regra.blocos.find((b) => b.codigo === parte.bloco);
      if (
        !bloco ||
        !PARCIAL_DO_TIPO[bloco.tipo as keyof typeof PARCIAL_DO_TIPO]
      )
        continue;
      const textos = justificativasDoCriterio(
        regra,
        bloco,
        lancamento,
        avaliacao,
      );
      for (const t of textos) usados.add(comparavel(t));
      criterios.push({
        rotulo: parte.rotulo,
        declarada: numero(parte.declarado),
        apurada: numero(parte.apurado ?? avaliacao.parciais?.[parte.parcial]),
        teto: numero(parte.teto),
        justificativas: textos,
      });
    }
    justificativas = [];
    if (resultado === "INAPTO_NOTA" && ehNumero(avaliacao.nota_minima)) {
      const item = texto(regra.corte?.item_edital);
      justificativas.push(
        `Nota consolidada ${numero(notaFinal)} abaixo da nota mínima de ${numeroDoParecer(avaliacao.nota_minima, 2)} pontos${item ? ` — item ${item}` : ""}.`,
      );
    }
    // As observações do parecer que não estão num critério (do avaliador, prontas e a geral).
    for (const t of avaliacao.observacoes ?? []) {
      const linha = texto(t);
      if (linha && !usados.has(comparavel(linha))) justificativas.push(linha);
    }
  }

  return {
    modelo,
    titulo: TITULO_DO_ESPELHO,
    candidato: nome,
    dados,
    notas,
    criterios,
    justificativas,
    nomeDoArquivo: `Espelho de nota${codigo ? ` ${codigo}` : ""}`,
  };
}

/* ── A página (HTML A4, impressão do navegador) ─────────────────────── */

const escapar = (valor: unknown) =>
  String(valor ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );

const ESTILO = `
  @page { size: A4; margin: 15mm 18mm 18mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #111; font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 11pt; line-height: 1.4; }
  .folha { max-width: 174mm; margin: 0 auto; padding: 8mm 0; }
  .timbrado { text-align: center; font-size: 8pt; line-height: 1.35; padding-bottom: 6pt; border-bottom: 1px solid #003b70; margin-bottom: 12pt; }
  .timbrado img { width: 22mm; height: auto; display: block; margin: 0 auto 6pt; }
  .timbrado p { margin: 0; text-align: center; }
  .timbrado p:first-of-type { font-weight: bold; color: #003b70; }
  h1 { font-size: 15pt; text-align: center; margin: 0; color: #003b70; }
  .subtitulo { text-align: center; margin: 2pt 0 14pt; color: #444; font-size: 10pt; }
  p { margin: 6pt 0; text-align: justify; }
  h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: .02em; background: #e8eef5; color: #003b70; margin: 14pt 0 0; padding: 4pt 6pt; border: 1px solid #b9c7d6; border-bottom: 0; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #b9c7d6; padding: 4pt 6pt; vertical-align: top; text-align: left; }
  table.dados th { width: 34%; background: #f6f8fb; font-weight: 600; }
  table.criterios th { background: #f6f8fb; }
  table.criterios td.n, table.criterios th.n { text-align: center; width: 15%; white-space: nowrap; }
  table.criterios tr.motivo td { font-size: 9.5pt; color: #333; background: #fcfcfd; }
  table.criterios tr.motivo ul { margin: 0; padding-left: 14pt; }
  .caixa { border: 1px solid #b9c7d6; padding: 6pt 8pt; }
  .caixa ul { margin: 0; padding-left: 14pt; }
  .caixa li { margin: 2pt 0; }
  .vazio { color: #555; font-style: italic; margin: 0; }
  .rodape { margin-top: 16pt; padding-top: 6pt; border-top: 1px solid #b9c7d6; font-size: 8.5pt; color: #444; }
`;

function tabelaDeLinhas(linhas: LinhaDoEspelho[], classe: string) {
  return `<table class="${classe}"><tbody>${linhas
    .map(
      (l) =>
        `<tr><th scope="row">${escapar(l.rotulo)}</th><td>${escapar(l.valor)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function listaOuVazio(textos: string[]) {
  return textos.length
    ? `<ul>${textos.map((t) => `<li>${escapar(t)}</li>`).join("")}</ul>`
    : `<p class="vazio">${escapar(SEM_OBSERVACAO)}</p>`;
}

/**
 * A página do espelho (HTML completo, sem script), para imprimir num iframe
 * (imprimirPagina) ou mostrar na prévia. `marca`: o cabeçalho e o logo de
 * Configurações › Marca (o padrão é o timbrado da AgSUS).
 */
export function paginaDoEspelho(
  espelho: Espelho,
  {
    cabecalho = CABECALHO_PADRAO,
    logo = "",
  }: { cabecalho?: string; logo?: string } = {},
) {
  const linhasDoCabecalho = String(cabecalho || CABECALHO_PADRAO)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const imagem = /^(https?:\/\/|\/)[^"'<>\s]*$/.test(logo)
    ? `<img src="${escapar(logo)}" alt="AgSUS">`
    : "";
  const criterios =
    espelho.modelo === "COM_PONTOS" && espelho.criterios.length
      ? `<h2>Pontuação por critério</h2><table class="criterios"><thead><tr><th scope="col">Critério</th><th scope="col" class="n">Declarada</th><th scope="col" class="n">Após análise</th><th scope="col" class="n">Teto</th></tr></thead><tbody>${espelho.criterios
          .map(
            (c) =>
              `<tr><td>${escapar(c.rotulo)}</td><td class="n">${escapar(c.declarada)}</td><td class="n">${escapar(c.apurada)}</td><td class="n">${escapar(c.teto)}</td></tr>` +
              (c.justificativas.length
                ? `<tr class="motivo"><td colspan="4"><ul>${c.justificativas.map((t) => `<li>${escapar(t)}</li>`).join("")}</ul></td></tr>`
                : ""),
          )
          .join("")}</tbody></table>`
      : "";
  return (
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(espelho.nomeDoArquivo)}</title><style>${ESTILO}</style></head>` +
    `<body><div class="folha" data-modelo="${espelho.modelo}">` +
    `<div class="timbrado">${imagem}${linhasDoCabecalho.map((l) => `<p>${escapar(l)}</p>`).join("")}</div>` +
    `<h1>${escapar(espelho.titulo)}</h1><p class="subtitulo">${escapar(SUBTITULO_DO_ESPELHO)}</p>` +
    `<p>Prezado(a) <strong>${escapar(espelho.candidato)}</strong>,</p>` +
    "<p>Apresenta-se, a seguir, o espelho de nota referente à avaliação realizada pela comissão avaliadora, para fins de consulta.</p>" +
    `<h2>Dados do registro</h2>${tabelaDeLinhas(espelho.dados, "dados")}` +
    `<h2>Notas</h2>${tabelaDeLinhas(espelho.notas, "dados notas")}` +
    criterios +
    `<h2>Justificativa / observação registrada</h2><div class="caixa">${listaOuVazio(espelho.justificativas)}</div>` +
    `<p class="rodape">${escapar(RODAPE_DO_ESPELHO)}</p>` +
    "</div></body></html>"
  );
}

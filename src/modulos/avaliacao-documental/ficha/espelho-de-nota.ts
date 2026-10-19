/*
  O botão "Espelho de nota" da ficha concluída (conclusao-da-ficha.tsx): monta
  o espelho com o que a ficha já carregou (sem consulta nova) e abre a
  impressão do navegador ou baixa o PDF (um arquivo, gerado no navegador).
  Nada é gravado: nem no banco, nem no Storage. Montagem e página:
  src/lib/avaliacao-documental/espelho-de-nota.ts; o PDF e o ZIP:
  src/lib/avaliacao-documental/espelho-em-pdf.ts.
  Os Espelhos de nota em massa (espelhos-em-massa.tsx) usam a mesma entrada
  (espelhoDaFichaGravada): o ZIP com um PDF por candidato ou a impressão de
  um documento só.
*/
import {
  documentoDosEspelhos,
  montarEspelho,
  paginaDoEspelho,
} from "../../../lib/avaliacao-documental/espelho-de-nota.ts";
import type {
  EntradaDoEspelho,
  Espelho,
} from "../../../lib/avaliacao-documental/espelho-de-nota.ts";
import {
  carregarBibliotecasDoPdf,
  nomeDoPdfDoEspelho,
  pdfDoEspelho,
  zipDosEspelhos,
  type BibliotecasDoPdf,
  type MarcaDoPdf,
} from "../../../lib/avaliacao-documental/espelho-em-pdf.ts";
import type { FichaDoEspelho } from "../../../lib/avaliacao-documental/espelhos-em-massa.ts";
import {
  TEXTOS_PADRAO_DO_ESPELHO,
  type TextosDoEspelho,
} from "../../../lib/avaliacao-documental/modelo-do-espelho.ts";
import {
  calcularFicha,
  regraDaFicha,
} from "../../../lib/avaliacao-documental/ficha.js";
import { CHAVE_DO_CABECALHO } from "../../../lib/cabecalho-dos-documentos.js";
import { LOGO_PADRAO_DA_BARRA } from "../../../lib/marca-da-barra-lateral.js";
import { nomeDaArea } from "../../../lib/menu-lateral.ts";
import {
  imprimirPagina,
  logoEmPng,
} from "../../classificacao/documento-no-navegador.ts";
import { baixarNoNavegador } from "../../classificacao/estado.ts";
import { estadoDasConfiguracoes } from "../../configuracoes/estado.js";

type FichaCarregada = {
  nome?: string | null;
  codigo?: string | number | null;
  modalidade?: string | null;
  vaga?: string | null;
  cargo?: string | null;
  art?: number | null;
  tp_resultado?: string | null;
  nota_final?: number | null;
  regime?: string | null;
  carga_horaria?: string | number | null;
};

type EstadoCarregado = {
  regra: unknown;
  lancamento: unknown;
  avaliacao: unknown;
  declarada?: unknown;
  dados: {
    edital?: { rotulo?: string | null; area?: string | null } | null;
    declarada_gravada?: { art?: number | null; total?: number | null } | null;
  };
};

const numeroOuNulo = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** A modalidade final da conta (calcularAvaliacao: modalidade_final), se houver. */
function modalidadeFinal(avaliacao: unknown): string | null {
  const valor =
    avaliacao && typeof avaliacao === "object"
      ? (avaliacao as { modalidade_final?: unknown }).modalidade_final
      : null;
  return typeof valor === "string" && valor ? valor : null;
}

/** A entrada do espelho a partir do estado da ficha e do cabeçalho dela. */
export function entradaDoEspelho(
  st: EstadoCarregado,
  ficha: FichaCarregada,
): EntradaDoEspelho {
  return {
    regra: st.regra as EntradaDoEspelho["regra"],
    lancamento: st.lancamento as EntradaDoEspelho["lancamento"],
    avaliacao: st.avaliacao as EntradaDoEspelho["avaliacao"],
    declarada: (st.declarada ?? null) as EntradaDoEspelho["declarada"],
    resultado: String(ficha.tp_resultado ?? ""),
    notaFinal: numeroOuNulo(ficha.nota_final),
    notaAutodeclarada:
      numeroOuNulo(ficha.art) ?? numeroOuNulo(st.dados.declarada_gravada?.art),
    candidato: {
      nome: ficha.nome,
      codigo: ficha.codigo,
      // A modalidade final da conta (a cota confirmada de maior percentual, ou a
      // ampla); sem ela, a da pré-classificação.
      modalidade: modalidadeFinal(st.avaliacao) ?? ficha.modalidade,
    },
    vaga: {
      codigo: ficha.vaga,
      cargo: ficha.cargo,
      regime: ficha.regime,
      cargaHoraria: ficha.carga_horaria,
    },
    edital: {
      rotulo: st.dados.edital?.rotulo,
      unidade: nomeDaArea(st.dados.edital?.area ?? null),
    },
  };
}

function cabecalhoConfigurado() {
  try {
    const valores = estadoDasConfiguracoes.obter().valores as
      { get?: (chave: string) => unknown } | undefined;
    return String(valores?.get?.(CHAVE_DO_CABECALHO) ?? "");
  } catch {
    return "";
  }
}

/** O timbrado da página HTML (impressão e prévia do modelo): cabeçalho de Configurações › Marca e logo. */
export function marcaDaPagina(cabecalho: () => string = cabecalhoConfigurado) {
  return { cabecalho: cabecalho() || undefined, logo: LOGO_PADRAO_DA_BARRA };
}

/**
 * O espelho de uma ficha concluída lida por obter_espelhos_de_nota (Espelhos
 * de nota em massa), pela MESMA montagem do botão da ficha: a regra da vaga
 * (regraDaFicha) com a configuração da versão usada na conclusão, a conta
 * (calcularFicha) e a declarada por critério gravada na conclusão
 * (DS_RESULTADO.declarada; o total é a soma, como em declaradaDaFicha).
 * `textos`: o modelo do edital (textosParaOEspelho), o mesmo da ficha.
 */
export function espelhoDaFichaGravada(
  ficha: FichaDoEspelho,
  configuracaoDaRegra: unknown,
  documental: unknown,
  edital: { rotulo?: string | null; area?: string | null } | null,
  textos: TextosDoEspelho = TEXTOS_PADRAO_DO_ESPELHO,
): Espelho {
  const lancamento = (ficha.lancamento ?? {}) as { nivel?: string };
  const regra = regraDaFicha(configuracaoDaRegra, lancamento);
  const avaliacao = calcularFicha(regra, lancamento, documental);
  const parciais: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(ficha.declarada ?? {}))
    if (typeof valor === "number" && Number.isFinite(valor))
      parciais[chave] = valor;
  const total = Object.values(parciais).reduce((a, b) => a + b, 0);
  return montarEspelho(
    entradaDoEspelho(
      {
        regra,
        lancamento,
        avaliacao,
        declarada: { parciais, total },
        dados: { edital, declarada_gravada: null },
      },
      {
        nome: ficha.nome,
        codigo: ficha.codigo,
        modalidade: ficha.modalidade,
        vaga: ficha.vaga,
        cargo: ficha.cargo,
        art: ficha.art,
        tp_resultado: ficha.resultado,
        nota_final: ficha.nota_final,
      },
    ),
    textos,
  );
}

/** Abre a impressão de vários espelhos num documento só (um por página). */
export function abrirEspelhosEmMassa(
  espelhos: Espelho[],
  {
    imprimir = imprimirPagina,
    cabecalho = cabecalhoConfigurado,
    titulo = "Espelhos de nota",
  }: {
    imprimir?: (html: string) => void;
    cabecalho?: () => string;
    titulo?: string;
  } = {},
) {
  imprimir(documentoDosEspelhos(espelhos, marcaDaPagina(cabecalho), titulo));
}

/** Abre a impressão do espelho de nota da ficha concluída, com os textos do modelo do edital. */
export function abrirEspelhoDeNota(
  st: EstadoCarregado,
  ficha: FichaCarregada,
  {
    imprimir = imprimirPagina,
    cabecalho = cabecalhoConfigurado,
    textos = TEXTOS_PADRAO_DO_ESPELHO,
  }: {
    imprimir?: (html: string) => void;
    cabecalho?: () => string;
    textos?: TextosDoEspelho;
  } = {},
) {
  const espelho = montarEspelho(entradaDoEspelho(st, ficha), textos);
  imprimir(paginaDoEspelho(espelho, marcaDaPagina(cabecalho)));
  return espelho.modelo;
}

/** O timbrado do PDF: o cabeçalho de Configurações › Marca e o logo em PNG (sem logo se falhar). */
async function marcaDoPdf(cabecalho: () => string): Promise<MarcaDoPdf> {
  return {
    cabecalho: cabecalho() || undefined,
    logo: await logoEmPng(LOGO_PADRAO_DA_BARRA),
  };
}

type Baixar = (bytes: BlobPart, nome: string, tipo: string) => void;

/** Baixa o PDF do espelho da ficha concluída (as bibliotecas vêm sob demanda). */
export async function baixarEspelhoEmPdf(
  st: EstadoCarregado,
  ficha: FichaCarregada,
  {
    carregar = carregarBibliotecasDoPdf,
    baixar = baixarNoNavegador,
    cabecalho = cabecalhoConfigurado,
    marca = marcaDoPdf,
    textos = TEXTOS_PADRAO_DO_ESPELHO,
  }: {
    carregar?: () => Promise<BibliotecasDoPdf>;
    baixar?: Baixar;
    cabecalho?: () => string;
    marca?: (cabecalho: () => string) => Promise<MarcaDoPdf>;
    textos?: TextosDoEspelho;
  } = {},
) {
  const espelho = montarEspelho(entradaDoEspelho(st, ficha), textos);
  const [libs, timbrado] = await Promise.all([carregar(), marca(cabecalho)]);
  const nome = nomeDoPdfDoEspelho(espelho);
  baixar(pdfDoEspelho(espelho, libs, timbrado), nome, "application/pdf");
  return nome;
}

/**
 * Gera o ZIP com um PDF por espelho (em lotes, com progresso) e baixa.
 * Devolve quantos PDFs entraram, ou null se cancelado.
 */
export async function baixarZipDosEspelhos(
  espelhos: Espelho[],
  nomeDoZip: string,
  {
    aoProgredir = () => {},
    cancelado = () => false,
    carregar = carregarBibliotecasDoPdf,
    baixar = baixarNoNavegador,
    cabecalho = cabecalhoConfigurado,
    marca = marcaDoPdf,
  }: {
    aoProgredir?: (feitos: number, total: number) => void;
    cancelado?: () => boolean;
    carregar?: () => Promise<BibliotecasDoPdf>;
    baixar?: Baixar;
    cabecalho?: () => string;
    marca?: (cabecalho: () => string) => Promise<MarcaDoPdf>;
  } = {},
): Promise<number | null> {
  const [libs, timbrado] = await Promise.all([carregar(), marca(cabecalho)]);
  const zip = await zipDosEspelhos(espelhos, libs, {
    marca: timbrado,
    aoProgredir,
    cancelado,
  });
  if (!zip) return null;
  baixar(zip.bytes, nomeDoZip, "application/zip");
  return zip.nomes.length;
}

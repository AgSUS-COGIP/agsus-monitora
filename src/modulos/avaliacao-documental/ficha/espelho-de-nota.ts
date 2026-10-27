/*
  O botão "Espelho de nota" da ficha concluída (conclusao-da-ficha.tsx): monta
  o espelho com o que a ficha já carregou (sem consulta nova) e abre a
  impressão do navegador ou baixa o PDF (um arquivo, gerado no navegador).
  Nada é gravado: nem no banco, nem no Storage. A entrada (entradaDoEspelho,
  espelhoDaFichaGravada): src/lib/avaliacao-documental/espelho-da-ficha-gravada.ts;
  montagem e página: src/lib/avaliacao-documental/espelho-de-nota.ts; o PDF e
  o ZIP: src/lib/avaliacao-documental/espelho-em-pdf.ts. Os Espelhos de nota
  em massa (espelhos-em-massa.tsx) montam pela mesma entrada: o ZIP com um PDF
  por candidato ou a impressão de um documento só.
*/
import {
  documentoDosEspelhos,
  montarEspelho,
  paginaDoEspelho,
} from "../../../lib/avaliacao-documental/espelho-de-nota.ts";
import type { Espelho } from "../../../lib/avaliacao-documental/espelho-de-nota.ts";
import {
  entradaDoEspelho,
  type EstadoCarregado,
  type FichaCarregada,
} from "../../../lib/avaliacao-documental/espelho-da-ficha-gravada.ts";
import {
  carregarBibliotecasDoPdf,
  nomeDoPdfDoEspelho,
  pdfDoEspelho,
  zipDosEspelhos,
  type BibliotecasDoPdf,
  type MarcaDoPdf,
} from "../../../lib/avaliacao-documental/espelho-em-pdf.ts";
import {
  TEXTOS_PADRAO_DO_ESPELHO,
  type TextosDoEspelho,
} from "../../../lib/avaliacao-documental/modelo-do-espelho.ts";
import { CHAVE_DO_CABECALHO } from "../../../lib/cabecalho-dos-documentos.ts";
import { LOGO_PADRAO_DA_BARRA } from "../../../lib/marca-da-barra-lateral.ts";
import {
  imprimirPagina,
  logoEmPng,
} from "../../classificacao/documento-no-navegador.ts";
import { baixarNoNavegador } from "../../classificacao/estado.ts";
import { estadoDasConfiguracoes } from "../../configuracoes/estado.ts";

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

type OpcoesDoPdf = {
  carregar?: () => Promise<BibliotecasDoPdf>;
  baixar?: Baixar;
  cabecalho?: () => string;
  marca?: (cabecalho: () => string) => Promise<MarcaDoPdf>;
};

/** PDF de um espelho já montado: uma implementação para ficha e pré-classificação. */
export async function baixarEspelhoProntoEmPdf(
  espelho: Espelho,
  {
    carregar = carregarBibliotecasDoPdf,
    baixar = baixarNoNavegador,
    cabecalho = cabecalhoConfigurado,
    marca = marcaDoPdf,
  }: OpcoesDoPdf = {},
) {
  const [libs, timbrado] = await Promise.all([carregar(), marca(cabecalho)]);
  const nome = nomeDoPdfDoEspelho(espelho);
  baixar(pdfDoEspelho(espelho, libs, timbrado), nome, "application/pdf");
  return nome;
}

/** Baixa o PDF do espelho da ficha concluída (as bibliotecas vêm sob demanda). */
export async function baixarEspelhoEmPdf(
  st: EstadoCarregado,
  ficha: FichaCarregada,
  {
    textos = TEXTOS_PADRAO_DO_ESPELHO,
    ...opcoes
  }: OpcoesDoPdf & { textos?: TextosDoEspelho } = {},
) {
  const espelho = montarEspelho(entradaDoEspelho(st, ficha), textos);
  return baixarEspelhoProntoEmPdf(espelho, opcoes);
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

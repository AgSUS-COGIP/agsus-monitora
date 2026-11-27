import type { TextosDaVisaoGeral } from "../visao-geral/tipos.ts";
import type {
  EscolhaDoRelatorio,
  RecorteDoRelatorio,
} from "../../lib/paineis/relatorio-da-visao-geral.ts";
import type { ClienteDoRelatorio } from "./dados-da-diretoria.ts";
import type { ExportacaoDaDiretoria } from "../../lib/paineis/relatorio-da-diretoria.ts";
import { erroDeVersaoNova } from "../../lib/carga/importar-com-recarga.ts";
import { nomeDaArea } from "../../lib/navegacao/menu-lateral.ts";
import {
  aprovadosNoRecorte,
  LIMITE_DE_APROVADOS_NO_PDF,
  linhasDeAprovados,
  linhasPorCargo,
} from "../../lib/paineis/relatorio-da-diretoria.ts";
import {
  graficosPermitidos,
  precisaDosAprovados,
} from "../../lib/paineis/graficos-do-relatorio.ts";
import {
  conteudoDoRelatorio,
  MODELOS_DO_RELATORIO,
  nomeDoArquivoDoRelatorio,
  secoesPermitidas,
  xlsxDoRelatorio,
} from "../../lib/paineis/relatorio-da-visao-geral.ts";
import {
  baixarAprovadosDaDiretoria,
  lerVagasPorCargo,
} from "./dados-da-diretoria.ts";
/* Estático: o montador já o traz no pedaço da tela (a miniatura), e o import() não dividia nada. */
import { imagensDosGraficos } from "./graficos-do-relatorio.tsx";

/*
  Gera o arquivo (PDF ou Excel) do relatório dos editais: o do montador
  (./montador-de-relatorio.tsx, com a escolha de quem gera) e o do cartão
  "Relatório da diretoria" (o modelo Diretoria, direto do cartão). "Vagas por
  cargo" e "Aprovados" (abas 2 e 3 da diretoria) são lidas do banco agora;
  "Aprovados" só entra para quem tem acesso à Lista de aprovados, e o banco
  registra cada download (./dados-da-diretoria.ts). Os gráficos "Contratações
  por mês" e "Situação dos aprovados" saem da mesma leitura (uma só, com a
  seção ou sem ela, ou a que a prévia já carregou no mesmo formato). As regras
  do conteúdo ficam em src/lib/paineis/relatorio-da-visao-geral.ts e
  graficos-do-relatorio.ts; o PDF, em
  src/lib/paineis/relatorio-da-visao-geral-em-pdf.ts (baixado só aqui), com a
  imagem de cada gráfico desenhada em ./graficos-do-relatorio.tsx.
*/

export interface PedidoDoRelatorio {
  /** Seções, colunas e formato (PDF ou XLSX; o CSV não passa por aqui). */
  escolha: EscolhaDoRelatorio;
  recorte: RecorteDoRelatorio;
  textos: TextosDaVisaoGeral;
  /** O cabeçalho dos documentos (Configurações). */
  cabecalho: string;
  /** Quem gera (vai no rodapé). */
  quem: string;
  agora: Date;
  supabase: ClienteDoRelatorio | null;
  /** Pode baixar nome e matrícula dos aprovados (a seção "aprovados"). */
  podeAprovados: boolean;
  /** Os aprovados que a prévia dos gráficos já leu (reaproveitados no mesmo formato). */
  aprovadosLidos?: AprovadosLidos | null;
}

/** Uma leitura de exportar_aprovados_da_diretoria: o formato registrado e os editais pedidos. */
export interface AprovadosLidos {
  formato: string;
  editais: readonly string[];
  exportacao: ExportacaoDaDiretoria;
}

/** A leitura serve ao pedido: o mesmo formato e os mesmos editais. */
export function servemAoPedido(
  lidos: AprovadosLidos | null | undefined,
  formato: string,
  editais: readonly string[],
): lidos is AprovadosLidos {
  return Boolean(
    lidos &&
    lidos.formato === formato &&
    lidos.editais.length === editais.length &&
    lidos.editais.every((id, i) => id === editais[i]),
  );
}

export interface RelatorioGerado {
  arquivo: Blob;
  nome: string;
}

/** O modelo Diretoria (editais, vagas por cargo e aprovados) no formato pedido. */
export function escolhaDaDiretoria(
  formato: "PDF" | "XLSX",
): EscolhaDoRelatorio {
  const modelo = MODELOS_DO_RELATORIO.find((m) => m.id === "diretoria");
  if (!modelo) throw new Error("O modelo Diretoria não existe.");
  return { ...modelo.escolha, formato };
}

async function gerarPdf(
  conteudo: ReturnType<typeof conteudoDoRelatorio>,
  cabecalho: string,
) {
  const [{ carregarBibliotecasDoPdf }, { pdfDoRelatorio }, { logoEmPng }] =
    await Promise.all([
      import("../../lib/avaliacao-documental/espelho-em-pdf.ts"),
      import("../../lib/paineis/relatorio-da-visao-geral-em-pdf.ts"),
      import("../classificacao/documento-no-navegador.ts"),
    ]).catch((erro: unknown) => {
      throw erroDeVersaoNova(erro);
    });
  const [bibliotecas, logo, imagens] = await Promise.all([
    carregarBibliotecasDoPdf(),
    logoEmPng().catch(() => null),
    conteudo.graficos.length
      ? imagensDosGraficos(conteudo.graficos).catch(() => [])
      : [],
  ]);
  const bytes = await pdfDoRelatorio(conteudo, bibliotecas, {
    cabecalho,
    logo,
    imagens,
  });
  return new Blob([bytes], { type: "application/pdf" });
}

async function gerarXlsx(conteudo: ReturnType<typeof conteudoDoRelatorio>) {
  const fflate = await import("fflate").catch((erro: unknown) => {
    throw erroDeVersaoNova(erro);
  });
  const bytes = xlsxDoRelatorio(conteudo, (arquivos, opcoes) =>
    fflate.zipSync(arquivos, opcoes),
  );
  return new Blob([new Uint8Array(bytes)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** O arquivo e o nome dele; erro com a mensagem para a tela. */
export async function gerarRelatorio({
  escolha,
  recorte: e,
  textos,
  cabecalho,
  quem,
  agora,
  supabase,
  podeAprovados,
  aprovadosLidos = null,
}: PedidoDoRelatorio): Promise<RelatorioGerado> {
  const permitidas = secoesPermitidas(podeAprovados);
  const secoes = escolha.secoes.filter((s) => permitidas.includes(s));
  const podeGraficos = graficosPermitidos(podeAprovados);
  const graficos = escolha.graficos.filter((g) => podeGraficos.includes(g));
  const area = e.area;
  const editais = e.filtradas.map((l) => String(l.id ?? "")).filter(Boolean);
  const comAprovados = secoes.includes("aprovados");
  const lerAprovados = comAprovados || precisaDosAprovados(graficos);
  if (
    comAprovados &&
    escolha.formato === "PDF" &&
    aprovadosNoRecorte(e.filtradas) > LIMITE_DE_APROVADOS_NO_PDF
  )
    throw new Error(
      `São ${aprovadosNoRecorte(e.filtradas).toLocaleString("pt-BR")} aprovados no recorte: acima de ${LIMITE_DE_APROVADOS_NO_PDF.toLocaleString("pt-BR")}, gere em Excel ou filtre os editais.`,
    );
  const [vagas, exportacao] = await Promise.all([
    secoes.includes("cargos")
      ? lerVagasPorCargo(supabase, area, editais)
      : null,
    !lerAprovados
      ? null
      : servemAoPedido(aprovadosLidos, escolha.formato, editais)
        ? aprovadosLidos.exportacao
        : baixarAprovadosDaDiretoria(supabase, area, escolha.formato, editais),
  ]);
  const conteudo = conteudoDoRelatorio({
    escolha: { ...escolha, secoes, graficos },
    linhas: e.filtradas,
    filtros: e.filtros,
    busca: e.busca,
    atalho: e.atalho,
    area: e.area,
    rotuloDaArea: nomeDaArea(e.area) || e.area,
    indicadores: e.indicadores,
    textos,
    quem,
    agora,
    porCargo: vagas ? linhasPorCargo(vagas, e.filtradas) : null,
    aprovados:
      exportacao && comAprovados
        ? {
            linhas: linhasDeAprovados(exportacao.aprovados, e.filtradas),
            registro: exportacao.id,
          }
        : null,
    aprovadosDosGraficos: exportacao
      ? { aprovados: exportacao.aprovados, registro: exportacao.id }
      : null,
  });
  const arquivo =
    escolha.formato === "PDF"
      ? await gerarPdf(conteudo, cabecalho)
      : await gerarXlsx(conteudo);
  return {
    arquivo,
    nome: nomeDoArquivoDoRelatorio(e.area, escolha.formato, agora),
  };
}

/** A mensagem da falha para a tela. */
export function mensagemDaFalha(falha: unknown): string {
  return falha instanceof Error && falha.message
    ? falha.message
    : "Não foi possível gerar o relatório.";
}

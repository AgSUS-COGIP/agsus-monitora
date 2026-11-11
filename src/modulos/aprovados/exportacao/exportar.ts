import type { LogoDoDocumento } from "../../../lib/classificacao/tipos-dos-documentos.ts";
import type {
  FormatoDaExportacao,
  PedidoDaExportacao,
  RegistroDaExportacao,
} from "../../../lib/exportacao-da-lista-de-aprovados.ts";
import type { ClienteDosAprovados } from "../tipos-do-estado.ts";
import {
  argumentosDoRegistro,
  contarRegistros,
  csvDaExportacao,
  MIME_DA_EXPORTACAO,
  nomeDoArquivoDaExportacao,
  registroDaResposta,
  xlsxDaExportacao,
} from "../../../lib/exportacao-da-lista-de-aprovados.ts";
import { erroDeVersaoNova } from "../../../lib/importar-com-recarga.ts";

/*
  Exportar a Lista de aprovados (issue #583), sem React:

    1. registra no banco (registrar_exportacao_aprovados): permissão, área,
       editais e o total da lista vigente conferidos lá; devolve o identificador
       e a data de emissão. Sem o registro confirmado, nenhum arquivo sai.
    2. gera o arquivo no navegador — CSV na hora; XLSX com o fflate e PDF com
       o jsPDF, por import dinâmico (os chunks do espelho de nota). O PDF cede a
       vez à tela a cada lote de linhas e informa o progresso;
    3. entrega para baixar. Nada vai a Storage, artifact ou log.

  Cancelar: fechar o modal antes do fim só descarta o arquivo; o registro já
  feito fica (a exportação foi pedida), e nada parcial é baixado.
*/

export type MarcaDaExportacao = {
  cabecalho: string;
  logo: LogoDoDocumento | null;
};

export type GerarPdf = (
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
  marca: MarcaDaExportacao,
  aoProgresso: (fracao: number) => void,
) => Promise<Uint8Array>;

export interface DependenciasDaExportacao {
  supabase: Pick<ClienteDosAprovados, "rpc"> | null;
  baixar: (arquivo: Blob, nome: string) => unknown;
  carregarLogo?: () => LogoDoDocumento | null | Promise<LogoDoDocumento | null>;
  cabecalho?: () => unknown;
  gerarPdf?: GerarPdf;
  /** Fração do PDF já desenhada (0 a 1). */
  aoProgresso?: (fracao: number) => void;
  /** Falso quando quem pediu desistiu (fechou o modal): o arquivo não é baixado. */
  seguir?: () => boolean;
}

export interface ResultadoDaExportacao {
  registro: RegistroDaExportacao;
  registros: number;
  nome: string;
}

type ErroDoBanco = { code?: unknown; message?: unknown };

/** A mensagem que a tela mostra para cada recusa do banco. */
export function mensagemDoErroDaExportacao(erro: unknown): string {
  const e: ErroDoBanco = erro && typeof erro === "object" ? erro : {};
  const codigo = String(e.code ?? "");
  const mensagem = String(e.message ?? erro ?? "").trim();
  if (codigo === "PGRST202")
    return "A exportação ainda não está disponível neste banco (falta a função registrar_exportacao_aprovados).";
  if (codigo === "42501")
    return mensagem || "Sem permissão para exportar esta lista.";
  if (codigo === "40001") return mensagem;
  return mensagem || "Não foi possível exportar a lista.";
}

const gerarPdfNaPagina: GerarPdf = async (
  pedido,
  registro,
  marca,
  aoProgresso,
) => {
  const [{ carregarBibliotecasDoPdf }, { pdfDaExportacao }] = await Promise.all(
    [
      import("../../../lib/avaliacao-documental/espelho-em-pdf.ts"),
      import("../../../lib/exportacao-da-lista-de-aprovados-em-pdf.ts"),
    ],
  ).catch((erro: unknown) => {
    throw erroDeVersaoNova(erro);
  });
  return pdfDaExportacao(
    pedido,
    registro,
    await carregarBibliotecasDoPdf(),
    marca,
    { aoProgresso },
  );
};

async function gerarXlsx(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
) {
  const fflate = await import("fflate").catch((erro: unknown) => {
    throw erroDeVersaoNova(erro);
  });
  return xlsxDaExportacao(pedido, registro, (arquivos, opcoes) =>
    fflate.zipSync(arquivos, opcoes),
  );
}

/** Registra e gera; devolve null quando quem pediu desistiu antes do fim. */
export async function exportarListaDeAprovados(
  pedido: PedidoDaExportacao,
  formato: FormatoDaExportacao,
  {
    supabase,
    baixar,
    carregarLogo = () => null,
    cabecalho = () => "",
    gerarPdf = gerarPdfNaPagina,
    aoProgresso = () => {},
    seguir = () => true,
  }: DependenciasDaExportacao,
): Promise<ResultadoDaExportacao | null> {
  if (!supabase) throw new Error("Sem conexão com o banco.");
  const { data, error } = await supabase.rpc(
    "registrar_exportacao_aprovados",
    argumentosDoRegistro(pedido, formato),
  );
  if (error) throw new Error(mensagemDoErroDaExportacao(error));
  const registro = registroDaResposta(data);

  let conteudo: BlobPart;
  if (formato === "CSV") conteudo = csvDaExportacao(pedido, registro);
  else if (formato === "XLSX")
    conteudo = new Uint8Array(await gerarXlsx(pedido, registro));
  else {
    const logo = await Promise.resolve()
      .then(() => carregarLogo())
      .catch(() => null);
    let marca = "";
    try {
      marca = String(cabecalho() || "");
    } catch {
      marca = "";
    }
    conteudo = new Uint8Array(
      await gerarPdf(pedido, registro, { cabecalho: marca, logo }, aoProgresso),
    );
  }
  if (!seguir()) return null;
  const nome = nomeDoArquivoDaExportacao(pedido, formato, registro.emitidaEm);
  baixar(new Blob([conteudo], { type: MIME_DA_EXPORTACAO[formato] }), nome);
  return { registro, registros: contarRegistros(pedido.candidatos), nome };
}

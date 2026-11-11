import type {
  FormatoDaExportacao,
  PedidoDaExportacao,
  RegistroDaExportacao,
} from "../../../lib/exportacao-da-lista-de-aprovados.ts";
import type { ResumoPorCargoEStatus } from "../../../lib/resumo-por-cargo-e-status.ts";
import type {
  DependenciasDaExportacao,
  MarcaDaExportacao,
} from "./exportar.ts";
import {
  MIME_DA_EXPORTACAO,
  registroDaResposta,
} from "../../../lib/exportacao-da-lista-de-aprovados.ts";
import {
  argumentosDoRegistroDoResumo,
  csvDoResumo,
  nomeDoArquivoDoResumo,
  xlsxDoResumo,
} from "../../../lib/exportacao-do-resumo-por-cargo.ts";
import { erroDeVersaoNova } from "../../../lib/importar-com-recarga.ts";
import { mensagemDoErroDaExportacao } from "./exportar.ts";

/*
  Exportar o Resumo por cargo e status: o mesmo caminho da lista (exportar.ts).
  Primeiro o registro no banco (registrar_exportacao_aprovados com p_conteudo
  'RESUMO'); sem ele, nenhum arquivo sai. Depois o arquivo no navegador, a
  partir do MESMO resumo que a tela desenha. Nada vai a Storage, artifact ou log.
*/

export type GerarPdfDoResumo = (
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
  resumo: ResumoPorCargoEStatus,
  marca: MarcaDaExportacao,
) => Promise<Uint8Array>;

const gerarPdfNaPagina: GerarPdfDoResumo = async (
  pedido,
  registro,
  resumo,
  marca,
) => {
  const [{ carregarBibliotecasDoPdf }, { pdfDoResumo }] = await Promise.all([
    import("../../../lib/avaliacao-documental/espelho-em-pdf.ts"),
    import("../../../lib/exportacao-do-resumo-por-cargo-em-pdf.ts"),
  ]).catch((erro: unknown) => {
    throw erroDeVersaoNova(erro);
  });
  return pdfDoResumo(
    pedido,
    registro,
    resumo,
    await carregarBibliotecasDoPdf(),
    marca,
  );
};

/** O banco ainda sem p_conteudo (migration do resumo não aplicada). */
export function mensagemDoErroDoResumo(erro: unknown): string {
  const codigo = String((erro as { code?: unknown } | null)?.code ?? "");
  if (codigo === "PGRST202")
    return "A exportação do resumo ainda não está disponível neste banco (falta a atualização de registrar_exportacao_aprovados).";
  return mensagemDoErroDaExportacao(erro);
}

export async function exportarResumoPorCargo(
  pedido: PedidoDaExportacao,
  resumo: ResumoPorCargoEStatus,
  formato: FormatoDaExportacao,
  {
    supabase,
    baixar,
    carregarLogo = () => null,
    cabecalho = () => "",
    seguir = () => true,
    gerarPdf = gerarPdfNaPagina,
  }: Omit<DependenciasDaExportacao, "gerarPdf" | "aoProgresso"> & {
    gerarPdf?: GerarPdfDoResumo;
  },
): Promise<{ registro: RegistroDaExportacao; nome: string } | null> {
  if (!supabase) throw new Error("Sem conexão com o banco.");
  const { data, error } = await supabase.rpc(
    "registrar_exportacao_aprovados",
    argumentosDoRegistroDoResumo(pedido, formato),
  );
  if (error) throw new Error(mensagemDoErroDoResumo(error));
  const registro = registroDaResposta(data);

  let conteudo: BlobPart;
  if (formato === "CSV") conteudo = csvDoResumo(pedido, registro, resumo);
  else if (formato === "XLSX") {
    const fflate = await import("fflate").catch((erro: unknown) => {
      throw erroDeVersaoNova(erro);
    });
    conteudo = new Uint8Array(
      xlsxDoResumo(pedido, registro, resumo, (arquivos, opcoes) =>
        fflate.zipSync(arquivos, opcoes),
      ),
    );
  } else {
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
      await gerarPdf(pedido, registro, resumo, { cabecalho: marca, logo }),
    );
  }
  if (!seguir()) return null;
  const nome = nomeDoArquivoDoResumo(pedido, formato, registro.emitidaEm);
  baixar(new Blob([conteudo], { type: MIME_DA_EXPORTACAO[formato] }), nome);
  return { registro, nome };
}

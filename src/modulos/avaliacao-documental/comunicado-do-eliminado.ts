import { espelhoDaEliminacaoPreAnalise } from "../../lib/avaliacao-documental/espelho-da-pre-classificacao.ts";
import { chaveDaPessoa } from "../../lib/avaliacao-documental/documentos-em-lote.ts";
import { baixarEspelhoProntoEmPdf } from "./ficha/espelho-de-nota.ts";
import type {
  EstadoDaPreClassificacao,
  InscritoDaPre,
} from "./tipos-da-pre-classificacao.ts";

/*
  O comunicado de eliminação antes da análise de UMA pessoa, em PDF: confere
  no banco a situação de agora só dela (conferir_eliminados_pre_classificacao)
  e recusa se ela deixou de estar eliminada. Usado na lista da vaga (aba Por
  vaga) e na aba Eliminados da Triagem.
*/
export async function baixarComunicadoDoEliminado(
  pre: Pick<EstadoDaPreClassificacao, "conferirEliminados">,
  c: InscritoDaPre,
  {
    cargo,
    edital,
    unidade,
  }: { cargo?: string | null; edital: string; unidade: string },
): Promise<void> {
  const atual = await pre.conferirEliminados([chaveDaPessoa(c.vaga, c.codigo)]);
  const registros = atual.candidatos.filter(
    (p) => p.codigo === c.codigo && p.vaga === c.vaga,
  );
  const confirmado = registros[0];
  if (
    registros.length !== 1 ||
    !confirmado ||
    confirmado.situacao !== "ELIMINADO"
  )
    throw new Error(
      "Situação alterada ou candidatura não encontrada. Atualize a lista.",
    );
  const espelho = espelhoDaEliminacaoPreAnalise({
    codigo: confirmado.codigo,
    nome: confirmado.nome,
    vaga: confirmado.vaga,
    cargo,
    edital,
    unidade,
    modalidade: confirmado.modalidade,
    situacao: confirmado.situacao,
    motivo: confirmado.motivo,
    motivo_codigo: confirmado.motivo_codigo,
    art: confirmado.art,
    declarada: confirmado.declarada,
    nota: confirmado.nota,
    origem_nota: confirmado.origem_nota,
  });
  await baixarEspelhoProntoEmPdf(espelho);
}

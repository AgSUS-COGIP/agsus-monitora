/*
  O modelo do espelho de nota no banco (migration 20261019120000): ler o do
  edital (qualquer pessoa da avaliação documental do edital, porque o botão
  "Espelho de nota" da ficha é de todos) e salvar (só a coordenação, com a
  versão que a tela abriu: outra versão = PT409). Regras e textos padrão em
  src/lib/avaliacao-documental/modelo-do-espelho.ts.
*/
import {
  diferencasDoPadrao,
  lerModeloDoEdital,
  TEXTOS_PADRAO_DO_ESPELHO,
  type ModeloDoEdital,
  type TextosDoEspelho,
} from "../../lib/avaliacao-documental/modelo-do-espelho.ts";
import { ehConflitoDeVersao } from "../../lib/conflito-de-versao.ts";

export const RPC_OBTER_MODELO_ESPELHO = "obter_modelo_espelho_nota";
export const RPC_SALVAR_MODELO_ESPELHO = "salvar_modelo_espelho_nota";

type Rpc = (
  nome: string,
  argumentos: Record<string, unknown>,
) => Promise<unknown>;

/** O modelo do edital (lança o erro do banco: para o editor). */
export async function obterModeloDoEspelho(
  rpc: Rpc,
  editalId: string,
): Promise<ModeloDoEdital> {
  return lerModeloDoEdital(
    await rpc(RPC_OBTER_MODELO_ESPELHO, { p_edital: editalId }),
  );
}

/**
 * Os textos para montar o espelho (ficha e em massa). Nunca falha: sem
 * edital, sem a RPC (migration ainda não aplicada) ou com erro de rede, o
 * espelho sai com o padrão, como antes do modelo existir.
 */
export async function textosParaOEspelho(
  rpc: Rpc | null | undefined,
  editalId: string | null | undefined,
): Promise<TextosDoEspelho> {
  if (!rpc || !editalId) return { ...TEXTOS_PADRAO_DO_ESPELHO };
  try {
    return (await obterModeloDoEspelho(rpc, editalId)).textos;
  } catch {
    return { ...TEXTOS_PADRAO_DO_ESPELHO };
  }
}

/** Salva os textos (só o que difere do padrão; {} = restaurar o padrão). */
export async function salvarModeloDoEspelho(
  rpc: Rpc,
  editalId: string,
  textos: TextosDoEspelho,
  versaoAberta: number,
): Promise<ModeloDoEdital> {
  return lerModeloDoEdital(
    await rpc(RPC_SALVAR_MODELO_ESPELHO, {
      p_edital: editalId,
      p_textos: diferencasDoPadrao(textos),
      p_versao_atual: versaoAberta,
    }),
  );
}

/** A mensagem do erro ao salvar: o conflito de versão pede para recarregar. */
export function mensagemDoErroDoModelo(erro: unknown): string {
  if (ehConflitoDeVersao(erro))
    return "O modelo foi alterado em outra aba ou por outra pessoa. Recarregue para ver a versão atual.";
  const mensagem =
    erro && typeof erro === "object"
      ? (erro as { message?: unknown }).message
      : null;
  return `Não foi possível salvar o modelo: ${typeof mensagem === "string" && mensagem ? mensagem : String(erro)}`;
}

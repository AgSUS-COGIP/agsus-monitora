import type { FormatoDoRelatorio } from "../../lib/visao-geral/relatorio-da-visao-geral.ts";
import {
  normalizarAprovadosDaDiretoria,
  normalizarVagasPorCargo,
} from "../../lib/visao-geral/relatorio-da-diretoria.ts";

/*
  As leituras das abas 2 e 3 do relatório da diretoria, na hora de gerar
  (migration 20261116120000). A aba 3 registra o download no banco antes de
  devolver nome e matrícula.
*/

type Resposta = PromiseLike<{ data: unknown; error: unknown }>;
export type ClienteDoRelatorio = {
  rpc: {
    (
      nome: "listar_vagas_por_cargo_da_visao_geral",
      parametros: { p_area: string; p_editais: string[] },
    ): Resposta;
    (
      nome: "exportar_aprovados_da_diretoria",
      parametros: { p_area: string; p_formato: string; p_editais: string[] },
    ): Resposta;
  };
};

/* A mensagem do banco, ou a de quando a função ainda não chegou a ele. */
function mensagemDoErro(erro: unknown, padrao: string): Error {
  const { code, message } = (erro || {}) as {
    code?: unknown;
    message?: unknown;
  };
  if (code === "PGRST202")
    return new Error(
      "O relatório da diretoria ainda não está disponível neste banco.",
    );
  return new Error(
    typeof message === "string" && message.trim() ? message : padrao,
  );
}

export async function lerVagasPorCargo(
  cliente: ClienteDoRelatorio | null,
  area: string,
  editais: string[],
) {
  if (!cliente) throw new Error("Sem conexão com o banco.");
  const { data, error } = await cliente.rpc(
    "listar_vagas_por_cargo_da_visao_geral",
    { p_area: area, p_editais: editais },
  );
  if (error)
    throw mensagemDoErro(error, "Não foi possível ler as vagas por cargo.");
  return normalizarVagasPorCargo(data);
}

export async function baixarAprovadosDaDiretoria(
  cliente: ClienteDoRelatorio | null,
  area: string,
  formato: FormatoDoRelatorio,
  editais: string[],
) {
  if (!cliente) throw new Error("Sem conexão com o banco.");
  const { data, error } = await cliente.rpc("exportar_aprovados_da_diretoria", {
    p_area: area,
    p_formato: formato,
    p_editais: editais,
  });
  if (error) throw mensagemDoErro(error, "Não foi possível ler os aprovados.");
  return normalizarAprovadosDaDiretoria(data);
}

import type { ClienteDosMarcos, MarcoDoAno } from "./tipos.ts";
import { registroDaVisaoGeral } from "../../lib/visao-geral.ts";
/*
  Os marcos do ano da equipe na Visão geral: a leitura do banco
  (`obter_marcos_da_area`, contrato em src/lib/rpc-contrato.js). Números só da
  equipe da área, nunca de uma pessoa. O card fica em boas-vindas.tsx; a regra
  de quando comemorar, em src/lib/comemoracao.js.
*/
export const RPC_MARCOS_DA_AREA = "obter_marcos_da_area";

/** `{ data, error }` da RPC; sem cliente, um erro (o card não aparece). */
export async function lerMarcosDaArea(
  supabase: ClienteDosMarcos | null,
  area: string,
): Promise<{ data: MarcoDoAno | null; error: unknown }> {
  if (!supabase?.rpc) return { data: null, error: new Error("Sem conexão.") };
  const resposta = await supabase.rpc(RPC_MARCOS_DA_AREA, { p_area: area });
  if (resposta.error) return { data: null, error: resposta.error };
  const registro = registroDaVisaoGeral(resposta.data);
  if (
    typeof registro.ano !== "number" ||
    !Number.isInteger(registro.ano) ||
    typeof registro.concluidas_no_ano !== "number" ||
    !Number.isFinite(registro.concluidas_no_ano) ||
    registro.concluidas_no_ano < 0
  )
    return { data: null, error: new Error("Marcos da área inválidos.") };
  return {
    data: { ano: registro.ano, concluidas_no_ano: registro.concluidas_no_ano },
    error: null,
  };
}

/*
  Os marcos do ano da equipe na Visão geral: a leitura do banco
  (`obter_marcos_da_area`, contrato em src/lib/rpc-contrato.js). Números só da
  equipe da área, nunca de uma pessoa. O card fica em boas-vindas.jsx; a regra
  de quando comemorar, em src/lib/comemoracao.js.
*/
export const RPC_MARCOS_DA_AREA = "obter_marcos_da_area";

/** `{ data, error }` da RPC; sem cliente, um erro (o card não aparece). */
export async function lerMarcosDaArea(supabase, area) {
  if (!supabase?.rpc) return { data: null, error: new Error("Sem conexão.") };
  return supabase.rpc(RPC_MARCOS_DA_AREA, { p_area: area });
}

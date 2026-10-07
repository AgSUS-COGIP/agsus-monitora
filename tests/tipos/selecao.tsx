/* Casos compilados, sem consultar o banco ou criar uma sessão real. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarEstadoDaSelecao } from "../../src/modulos/selecao/estado.ts";
import type { ClienteDaSelecao } from "../../src/modulos/selecao/tipos.ts";
import { comTempoLimite } from "../../src/lib/falha-de-rede.js";

declare const clienteReal: SupabaseClient;
const cliente: ClienteDaSelecao = clienteReal;
const estado = criarEstadoDaSelecao({ supabase: cliente });

estado.carregar("saude-indigena");
const cancelar: () => void = estado.assinar(() => {});
cancelar();
const snapshot = estado.obter();
if (snapshot.dados) {
  estado.exportarCsv(snapshot.dados.vagas);
  const inscritos: number | null | undefined =
    snapshot.dados.vagas[0]?.inscritos;
  // @ts-expect-error — contagens normalizadas não são texto.
  const inscritosComoTexto: string = snapshot.dados.vagas[0]?.inscritos;
  // @ts-expect-error — timestamps preservados do JSON não foram validados.
  snapshot.dados.geradoEm.toISOString();
}

// @ts-expect-error — área não é um número.
estado.carregar(7);
// @ts-expect-error — snapshots são somente leitura; alterações passam pelo store.
snapshot.area = "sede";
// @ts-expect-error — dados ainda podem estar ausentes na primeira carga.
estado.exportarCsv(snapshot.dados.vagas);
// @ts-expect-error — a Seleção usa apenas sua RPC de leitura.
cliente.rpc("publicar_classificacao", { p_area: "sede" });
// @ts-expect-error — a RPC exige o argumento p_area como string.
cliente.rpc("get_selecao_da_area", { p_area: 7 });

const comLimite: Promise<{ data: unknown; error: unknown }> = comTempoLimite(
  cliente.rpc("get_selecao_da_area", { p_area: "sede" }),
);
// @ts-expect-error — limitar o tempo mantém o tipo de retorno da operação.
const numeroComLimite: Promise<number> = comLimite;

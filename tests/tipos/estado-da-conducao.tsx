import type { SupabaseClient } from "@supabase/supabase-js";
import { criarEstadoDaConducao } from "../../src/modulos/entrevistas/estado-da-conducao.ts";
import type { ClienteDaConducao } from "../../src/modulos/entrevistas/tipos-do-estado-da-conducao.ts";
import type { EstadoDaConducaoComAcoes } from "../../src/modulos/entrevistas/tipos.ts";
declare const supabase: SupabaseClient;
const cliente: ClienteDaConducao = supabase;
const estado: EstadoDaConducaoComAcoes = criarEstadoDaConducao({
  supabase: cliente,
});
estado.lancarNotas("i1", {
  notas: [{ competencia: "c1", avaliador: "a1", nota: 4 }],
});
estado.configurar({
  roteiro: "r1",
  lancamento: "SECRETARIA",
  banca: [],
  avaliadores: [],
});
estado.renomearRoteiro("r1", null, "Retirar o nome antigo");
// @ts-expect-error O cliente só declara as RPCs consumidas pelo estado.
cliente.rpc("rpc_inexistente");
// @ts-expect-error Identificadores de entrevistas são textuais.
estado.lancarNotas(7, { notas: [] });
// @ts-expect-error A configuração precisa do identificador de roteiro.
estado.configurar({ lancamento: "SECRETARIA", banca: [], avaliadores: [] });

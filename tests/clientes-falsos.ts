import type { ClienteDosAprovados } from "../src/modulos/aprovados/tipos-do-estado.ts";

/*
  Clientes do Supabase de mentira, tipados, para os testes que só respondem
  RPCs. O que o teste não preparou quebra na hora, dizendo o que faltou.
*/

/** O cliente da Lista de aprovados só com `rpc`; o storage não foi preparado. */
export function clienteDosAprovados(
  rpc: ClienteDosAprovados["rpc"],
): ClienteDosAprovados {
  return {
    rpc,
    storage: {
      from: () => {
        throw new Error("O teste não preparou o storage do Supabase.");
      },
    },
  };
}

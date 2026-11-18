import { PGlite } from "@electric-sql/pglite";
import { esquecerBanco, lembrarBanco } from "./bancos-abertos.ts";

/*
  Montar um banco de teste (PGlite + infraestrutura + funções + migrations)
  leva ~1,8 s; clonar um já montado, ~0,3 s. O molde é montado na primeira
  chamada e guardado no módulo, que o Vitest recarrega a cada arquivo de teste:
  um molde por arquivo, e cada chamada devolve um clone limpo e independente.

  O molde vive o arquivo inteiro e fica fora do registro dos bancos abertos;
  cada clone entra nele e é fechado no fim do teste ou do bloco que o pediu
  (bancos-abertos.ts).
*/
export function moldeDeBanco(
  montar: () => Promise<PGlite>,
): () => Promise<PGlite> {
  let molde: Promise<PGlite> | undefined;
  return async () => {
    molde ??= montar().then((banco) => {
      esquecerBanco(banco);
      return banco;
    });
    // clone() é tipado como PGliteInterface, mas devolve um PGlite.create().
    const clone = await (await molde).clone();
    if (!(clone instanceof PGlite))
      throw new Error("clone() não devolveu um PGlite");
    return lembrarBanco(clone);
  };
}

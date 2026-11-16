import { PGlite } from "@electric-sql/pglite";

/*
  Montar um banco de teste (PGlite + infraestrutura + funções + migrations)
  leva ~1,8 s; clonar um já montado, ~0,3 s. O molde é montado na primeira
  chamada e guardado no módulo, que o Vitest recarrega a cada arquivo de teste:
  um molde por arquivo, e cada chamada devolve um clone limpo e independente.

  Os clones não são fechados aqui, como os bancos montados do zero também não
  eram: há arquivos que montam bancos num beforeAll e os usam em vários testes.
*/
export function moldeDeBanco(
  montar: () => Promise<PGlite>,
): () => Promise<PGlite> {
  let molde: Promise<PGlite> | undefined;
  return async () => {
    molde ??= montar();
    // clone() é tipado como PGliteInterface, mas devolve um PGlite.create().
    const clone = await (await molde).clone();
    if (!(clone instanceof PGlite))
      throw new Error("clone() não devolveu um PGlite");
    return clone;
  };
}

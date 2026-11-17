import { describe, expect, it } from "vitest";
import {
  ACIMA_DO_LIMITE,
  conferirLib,
  LIMITE_POR_PASTA,
  SOLTOS_PERMITIDOS,
} from "../../scripts/check-lib-sem-arquivo-solto.mjs";

/*
  src/lib/ é organizada por assunto (docs/biblioteca/mapa-do-repositorio.md):
  arquivo de lógica vai para a pasta do assunto, nunca solto na raiz, e
  nenhuma pasta passa de 30 arquivos diretos (passou, ganha subpasta).
*/

const pasta = (caminho: string, quantos: number) =>
  Array.from({ length: quantos }, (_, i) => `${caminho}/arquivo-${i}.ts`);

describe("conferirLib", () => {
  it("na raiz só podem ficar o CLAUDE.md e o contrato de RPC", () => {
    expect(SOLTOS_PERMITIDOS).toEqual(["CLAUDE.md", "rpc-contrato.ts"]);
    expect(LIMITE_POR_PASTA).toBe(30);
  });

  it("aceita a raiz com os permitidos e arquivos dentro de pastas", () => {
    expect(
      conferirLib([
        "src/lib/CLAUDE.md",
        "src/lib/rpc-contrato.ts",
        "src/lib/aya/busca-da-aya.ts",
      ]),
    ).toEqual([]);
  });

  it("acusa arquivo solto na raiz", () => {
    expect(
      conferirLib(["src/lib/rpc-contrato.ts", "src/lib/formatters.ts"]),
    ).toEqual([
      "src/lib/formatters.ts está solto em src/lib/: coloque na pasta do assunto",
    ]);
  });

  it("acusa pasta com mais de 30 arquivos diretos", () => {
    const problemas = conferirLib(pasta("src/lib/aya", 31));
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("src/lib/aya/");
    expect(problemas[0]).toContain("31");
  });

  it("conta só os arquivos diretos: subpasta não soma na pasta de cima", () => {
    expect(
      conferirLib([
        ...pasta("src/lib/aya", 30),
        ...pasta("src/lib/aya/tours", 5),
      ]),
    ).toEqual([]);
  });

  it("pasta que já passava do limite antes da organização só pode encolher", () => {
    const [registrada = "", tamanho = 0] =
      Object.entries(ACIMA_DO_LIMITE)[0] ?? [];
    expect(registrada).toBe("src/lib/avaliacao-documental/");
    expect(tamanho).toBeGreaterThan(LIMITE_POR_PASTA);
    expect(conferirLib(pasta(registrada.slice(0, -1), tamanho))).toEqual([]);
    expect(conferirLib(pasta(registrada.slice(0, -1), tamanho - 1))).toEqual(
      [],
    );
    const cresceu = conferirLib(pasta(registrada.slice(0, -1), tamanho + 1));
    expect(cresceu).toHaveLength(1);
    expect(cresceu[0]).toContain(`${tamanho + 1}`);
  });

  it("ignora o que não está em src/lib/", () => {
    expect(
      conferirLib(["src/modulos/solto.ts", "tests/solto.test.ts"]),
    ).toEqual([]);
  });
});

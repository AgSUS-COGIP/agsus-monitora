import { describe, expect, it } from "vitest";
import {
  conferirBiblioteca,
  extrairLinks,
  lerCabecalho,
  lerRepositorio,
} from "../scripts/checar-links-da-biblioteca.mjs";

/*
  A biblioteca de documentação (docs/biblioteca/, índice no CLAUDE.md da raiz): todo
  [[link]] aponta para uma nota que existe e toda nota é ligada por outro arquivo.
  O script é scripts/checar-links-da-biblioteca.mjs (npm run check:docs).
*/

const CABECALHO =
  "---\ntipo: guia\narea: front\natualizado: 2026-11-10\n---\n\n";

function nota(corpo: string): string {
  return `${CABECALHO}${corpo}\n`;
}

describe("extrairLinks", () => {
  it("lê o nome do link, com texto alternativo ou seção", () => {
    expect(
      extrairLinks(
        "Ver [[testes]], [[banco-e-migrations|o banco]] e [[css#Onde colocar]].",
      ),
    ).toEqual(["testes", "banco-e-migrations", "css"]);
  });

  it("não conta link dentro de crase nem de bloco de código", () => {
    const texto = [
      "Cada `[[nome]]` é uma nota.",
      "```",
      "[[exemplo-em-bloco]]",
      "```",
      "Mas [[de-verdade]] conta.",
    ].join("\n");
    expect(extrairLinks(texto)).toEqual(["de-verdade"]);
  });
});

describe("lerCabecalho", () => {
  it("lê tipo, area e atualizado", () => {
    expect(lerCabecalho(nota("# Título"))).toEqual({
      tipo: "guia",
      area: "front",
      atualizado: "2026-11-10",
    });
  });

  it("devolve null sem cabeçalho", () => {
    expect(lerCabecalho("# Título\n")).toBeNull();
  });
});

describe("conferirBiblioteca", () => {
  const indice = new Map([["CLAUDE.md", "Índice: [[a]] e [[b]]."]]);

  it("passa quando todo link tem nota e toda nota é ligada", () => {
    const notas = new Map([
      ["a", nota("Ver [[b]].")],
      ["b", nota("Ver [[a]].")],
    ]);
    expect(conferirBiblioteca({ notas, fontes: indice })).toEqual([]);
  });

  it("acusa link quebrado, dizendo o arquivo e o destino", () => {
    const notas = new Map([
      ["a", nota("Ver [[nao-existe]].")],
      ["b", nota("")],
    ]);
    expect(conferirBiblioteca({ notas, fontes: indice })).toEqual([
      "docs/biblioteca/a.md: [[nao-existe]] não tem nota em docs/biblioteca/nao-existe.md",
    ]);
  });

  it("acusa link quebrado também num CLAUDE.md de pasta", () => {
    const notas = new Map([
      ["a", nota("")],
      ["b", nota("")],
    ]);
    const fontes = new Map([
      ...indice,
      ["src/lib/CLAUDE.md", "Ver [[logica-que-sumiu]]."],
    ]);
    expect(conferirBiblioteca({ notas, fontes })).toEqual([
      "src/lib/CLAUDE.md: [[logica-que-sumiu]] não tem nota em docs/biblioteca/logica-que-sumiu.md",
    ]);
  });

  it("acusa nota órfã; o link dela para ela mesma não conta", () => {
    const notas = new Map([
      ["a", nota("")],
      ["b", nota("")],
      ["solta", nota("Esta é [[solta]].")],
    ]);
    expect(conferirBiblioteca({ notas, fontes: indice })).toEqual([
      "docs/biblioteca/solta.md: nota órfã (nenhum CLAUDE.md nem outra nota liga para ela)",
    ]);
  });

  it("acusa nota com o nome de outro .md do vault", () => {
    const notas = new Map([
      ["a", nota("")],
      ["b", nota("")],
    ]);
    const outrosNomes = new Map([["b", "docs/b.md"]]);
    expect(conferirBiblioteca({ notas, fontes: indice, outrosNomes })).toEqual([
      "docs/biblioteca/b.md: mesmo nome de docs/b.md (o [[link]] fica ambíguo no Obsidian)",
    ]);
  });

  it("acusa cabeçalho ausente ou com valor fora da lista", () => {
    const notas = new Map([
      ["a", "# Sem cabeçalho\n"],
      ["b", "---\ntipo: rascunho\narea: front\natualizado: ontem\n---\n"],
    ]);
    expect(conferirBiblioteca({ notas, fontes: indice })).toEqual([
      "docs/biblioteca/a.md: sem cabeçalho YAML (tipo, area, atualizado)",
      'docs/biblioteca/b.md: tipo "rascunho" fora de regra, guia, modulo, decisao, referencia',
      'docs/biblioteca/b.md: atualizado "ontem" não é AAAA-MM-DD',
    ]);
  });
});

describe("a biblioteca deste repositório", () => {
  it("não tem link quebrado, nota órfã nem nome repetido", () => {
    const entrada = lerRepositorio(process.cwd());
    expect(entrada.notas.size).toBeGreaterThan(0);
    expect(entrada.fontes.has("CLAUDE.md")).toBe(true);
    expect(conferirBiblioteca(entrada)).toEqual([]);
  });
});

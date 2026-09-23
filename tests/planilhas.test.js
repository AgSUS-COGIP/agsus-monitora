import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  PLANILHAS,
  urlDaPlanilhaGoogle,
  urlDeExportacaoXlsx,
} from "../src/lib/planilhas.js";

const RAIZ = process.cwd();
const CATALOGO = join("src", "lib", "planilhas.js");

function arquivosDeCodigo(pasta) {
  const saida = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory())
      saida.push(...arquivosDeCodigo(caminho));
    else if (/\.(js|mjs|html)$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

describe("catálogo de planilhas", () => {
  it("monta o link de edição do Google Sheets a partir do id", () => {
    expect(urlDaPlanilhaGoogle("1AbC_def-GHIjkl")).toBe(
      "https://docs.google.com/spreadsheets/d/1AbC_def-GHIjkl/edit",
    );
    expect(urlDeExportacaoXlsx(" 1AbC_def-GHIjkl ")).toBe(
      "https://docs.google.com/spreadsheets/d/1AbC_def-GHIjkl/export?format=xlsx",
    );
  });

  it("não monta link com id vazio, curto ou com caracteres de URL", () => {
    for (const id of [
      null,
      undefined,
      "",
      "   ",
      "abc",
      "1Abc/../../x",
      "1AbcDefGhij?x=1",
      "javascript:alert(1)",
    ]) {
      expect(urlDaPlanilhaGoogle(id)).toBe("");
      expect(urlDeExportacaoXlsx(id)).toBe("");
    }
  });

  it("o modelo de importação aponta para um arquivo que existe no build", () => {
    const modelo = PLANILHAS.modeloListaAprovados;
    // Tudo em public/ é servido na raiz do site.
    expect(join("public", modelo.url)).toBe(join(modelo.arquivoNoRepositorio));
    expect(existsSync(join(RAIZ, modelo.arquivoNoRepositorio))).toBe(true);
    expect(modelo.url.endsWith(`/${modelo.nomeDoArquivo}`)).toBe(true);
  });

  it("nenhum código fora do catálogo escreve link, caminho ou bucket de planilha", () => {
    const proibidos = [
      "docs.google.com/spreadsheets",
      PLANILHAS.modeloListaAprovados.nomeDoArquivo,
      `"${PLANILHAS.listaAprovadosImportada.bucket}"`,
    ];
    const arquivos = [
      ...["src", "api", "scripts"].flatMap((pasta) =>
        arquivosDeCodigo(join(RAIZ, pasta)),
      ),
      join(RAIZ, "index.html"),
      join(RAIZ, "analises.html"),
    ].filter((caminho) => relative(RAIZ, caminho) !== CATALOGO);

    const violacoes = arquivos.flatMap((caminho) => {
      const texto = readFileSync(caminho, "utf8");
      return proibidos
        .filter((trecho) => texto.includes(trecho))
        .map((trecho) => `${relative(RAIZ, caminho)} contém ${trecho}`);
    });

    expect(violacoes).toEqual([]);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cabecalhosDaTabela,
  tabelaEmCartoes,
  tabelasDaTelaEmCartoes,
} from "../src/app/casca/tabelas-em-cartoes.ts";

/*
  Auditoria das telas (13/10/2026), no celular (375px):
  - os cartões das tabelas (tabelas-em-cartoes) guardavam a largura mínima da
    tela — 560px na Classificação, 760px na Fila, 980px nas demais tabelas da
    rolagem — e passavam da borda; o reset valia só para Editais e Aprovados;
  - o "Gerada em … · SHA-256 …" da Classificação (.status-discreto, nowrap)
    alargava o cartão de exportação e a página rolava 287px de lado.
*/

const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, "");

function arquivosCss(pasta, saida = []) {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) arquivosCss(caminho, saida);
    else if (nome.endsWith(".css")) saida.push(caminho);
  }
  return saida;
}

/* Especificidade simples: [ids, classes + atributos + pseudo-classes, tipos]. */
function especificidade(seletor) {
  const s = seletor.replace(/::[\w-]+/g, "");
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!not\b)[\w-]+/g) || [])
    .length;
  const tipos = (s.replace(/\[[^\]]+\]/g, "").match(/(^|[\s>+~])[a-z]+/g) || [])
    .length;
  return ids * 10000 + classes * 100 + tipos;
}

/* Os seletores de regras que dão min-width a uma tabela da rolagem. */
function regrasDeLargura() {
  const regras = [];
  for (const arquivo of arquivosCss("src")) {
    const fonte = semComentarios(readFileSync(arquivo, "utf8"));
    for (const m of fonte.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/min-width:\s*[1-9]/.test(m[2])) continue;
      for (const seletor of m[1].split(",").map((x) => x.trim()))
        if (/\.ui-tabela-rolagem table/.test(seletor))
          regras.push({ arquivo, seletor });
    }
  }
  return regras;
}

describe("tabelas no celular", () => {
  const css = semComentarios(
    readFileSync("src/styles/mobile-table-cards.css", "utf8"),
  );
  const RESET =
    ".ui-tabela-rolagem table.mobile-card-table[data-mobile-enhanced]";

  it("o cartão perde a largura mínima em toda tela, não só em Editais e Aprovados", () => {
    expect(css).toMatch(
      /\.ui-tabela-rolagem table\.mobile-card-table\[data-mobile-enhanced\]\s*\{\s*min-width:\s*0;/,
    );
    expect(css).not.toContain(
      ".nucleo-page-card .ui-tabela-rolagem table.mobile-card-table",
    );
  });

  it("o reset vence toda largura mínima das tabelas da rolagem", () => {
    const regras = regrasDeLargura();
    expect(regras.length).toBeGreaterThan(3);
    for (const { arquivo, seletor } of regras)
      expect(especificidade(RESET), `${arquivo}: ${seletor}`).toBeGreaterThan(
        especificidade(seletor),
      );
  });

  it("a tabela em cartão ganha a classe e o data-mobile-enhanced juntos", () => {
    document.body.innerHTML =
      "<table><thead><tr><th>Nome</th></tr></thead><tbody><tr><td>Ana</td></tr></tbody></table>";
    const tabela = document.querySelector("table");
    expect(tabelaEmCartoes(tabela)).toBe(true);
    expect(tabela.classList.contains("mobile-card-table")).toBe(true);
    expect(tabela.dataset.mobileEnhanced).toBe("true");
  });

  it("o texto discreto quebra linha fora do topo", () => {
    const ui = semComentarios(readFileSync("src/ui/ui.css", "utf8"));
    const geral = ui.match(/\n\.status-discreto\s*\{([^}]*)\}/)?.[1] || "";
    expect(geral).not.toContain("nowrap");
    expect(ui).toMatch(
      /\.ui-topo-acoes \.status-discreto\s*\{[^}]*white-space:\s*nowrap/,
    );
  });
});

describe("abas no celular", () => {
  const ui = semComentarios(readFileSync("src/ui/ui.css", "utf8"));
  const celular = ui.slice(ui.indexOf("@media (max-width: 640px)"));

  it("as abas não encolhem abaixo do texto: descem de linha", () => {
    expect(celular).toMatch(/\.ui-abas\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(celular).toMatch(/\.ui-aba\s*\{[^}]*flex:\s*1 0 auto/);
    expect(celular).not.toMatch(/\.ui-aba\s*\{[^}]*min-width:\s*0/);
  });
});

describe("quais tabelas viram cartão", () => {
  const TABELA =
    "<thead><tr><th>Nome</th><th>UF</th></tr></thead><tbody><tr><td>Ana</td><td>AM</td></tr></tbody>";
  const larguraOriginal = window.innerWidth;
  const largura = (px) =>
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: px,
    });

  it("só no celular, com rótulo por coluna, sem as que rolam de lado ou são grade", () => {
    document.body.innerHTML = `
      <table id="comum">${TABELA}</table>
      <table id="rola" data-mobile-table="scroll">${TABELA}</table>
      <table id="grade" role="grid">${TABELA}</table>`;
    try {
      largura(1280);
      expect(tabelasDaTelaEmCartoes()).toBe(0);
      largura(390);
      expect(tabelasDaTelaEmCartoes()).toBe(1);
    } finally {
      largura(larguraOriginal);
    }
    expect(
      [...document.querySelectorAll("#comum td")].map(
        (td) => td.dataset.mobileLabel,
      ),
    ).toEqual(["Nome", "UF"]);
    expect(document.getElementById("rola").dataset.mobileEnhanced).toBe(
      undefined,
    );
    expect(document.getElementById("grade").dataset.mobileEnhanced).toBe(
      undefined,
    );
  });
});

describe("rótulo do cartão sem texto no cabeçalho", () => {
  it("usa o nome acessível do controle, não 'Campo 1'", () => {
    document.body.innerHTML =
      '<table><thead><tr><th><input type="checkbox" aria-label="Selecionar as fichas da lista"></th><th>Nome</th><th></th></tr></thead><tbody><tr><td></td><td>Ana</td><td></td></tr></tbody></table>';
    expect(cabecalhosDaTabela(document.querySelector("table"))).toEqual([
      "Selecionar as fichas da lista",
      "Nome",
      "Campo 3",
    ]);
  });
});

/*
  A arara da Aya (canto inferior direito) cobria o botão principal das barras
  presas ao pé: "Concluir e próxima" (ficha), "Salvar e próximo"
  (entrevistas) e "Salvar alterações" (Configurações).
*/
describe("barras de ação e a arara da Aya", () => {
  const css = (caminho) => semComentarios(readFileSync(caminho, "utf8"));

  it("o canto da arara é um token só", () => {
    expect(css("src/styles/app.css")).toMatch(/--aya-reserva:\s*\d+px/);
  });

  it.each([
    [
      "src/modulos/avaliacao-documental/ficha/ficha.css",
      /\.avd-ficha-barra\s*\{[^}]*padding-right:[^;]*var\(--aya-reserva/,
    ],
    [
      "src/modulos/entrevistas/entrevistas.css",
      /\.entrevistas-analise-barra\s*\{[^}]*padding-right:[^;]*var\(--aya-reserva/,
    ],
    [
      "src/modulos/configuracoes/configuracoes.css",
      /\.config-barra\s*\{[^}]*right:[^;]*var\(--aya-reserva/,
    ],
  ])("%s recua da arara", (arquivo, regra) => {
    expect(css(arquivo)).toMatch(regra);
  });
});

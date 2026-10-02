import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Proporções das telas (varredura a 1366px e a 390px). O jsdom não mede
  layout, então o teste garante, no CSS de origem, as propriedades que fazem
  cada correção funcionar: KPIs da mesma altura com rótulo em até duas linhas,
  nomes de Acessos com reticências, cartões da galeria sem estouro e o botão
  Restaurar da Operação na linha de baixo no celular.
*/

const ler = (caminho) => readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
const semComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Declarações de todos os blocos cujo seletor (na lista) é exatamente `seletor`. */
function regra(css, seletor) {
  const alvo = seletor.replace(/\s+/g, " ").trim();
  const declaracoes = {};
  for (const [, seletores, corpo] of semComentarios(css).matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )) {
    const lista = seletores
      .split(",")
      .map((s) => s.replace(/\s+/g, " ").trim());
    if (!lista.includes(alvo)) continue;
    for (const linha of corpo.split(";")) {
      const i = linha.indexOf(":");
      if (i > 0)
        declaracoes[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
    }
  }
  return declaracoes;
}

const esperaDuasLinhas = (declaracoes) => {
  expect(declaracoes.display).toBe("-webkit-box");
  expect(declaracoes["-webkit-box-orient"]).toBe("vertical");
  expect(declaracoes["-webkit-line-clamp"]).toBe("2");
  expect(declaracoes["line-clamp"]).toBe("2");
  expect(declaracoes.overflow).toBe("hidden");
  expect(declaracoes["min-width"]).toBe("0");
};

describe("KPIs: mesma altura, rótulo em até duas linhas", () => {
  it("Kpi de src/ui (Análises, Recursos, Seleção, Entrevistas, prévia da Página inicial)", () => {
    const css = ler("src/ui/ui.css");
    expect(regra(css, ".ui-kpis")["grid-auto-rows"]).toBe("1fr");
    expect(regra(css, ".ui-kpi")["min-height"]).toBe("78px");
    esperaDuasLinhas(regra(css, ".ui-kpi-texto"));
    expect(regra(css, ".ui-kpi-valor")["margin-top"]).toBe("auto");

    const jsx = ler("src/ui/kpi.jsx");
    expect(jsx).toContain('className="ui-kpi-texto"');
    expect(jsx).toContain(
      'title={typeof rotulo === "string" ? rotulo : undefined}',
    );
  });

  it("nenhum módulo troca a grade de KPIs por linhas de altura livre", () => {
    for (const caminho of [
      "src/modulos/entrevistas/entrevistas.css",
      "src/modulos/recursos/recursos.css",
      "src/modulos/selecao/selecao.css",
      "src/modulos/editais/editais.css",
      "src/modulos/cronograma/cronograma.css",
      "src/modulos/aprovados/aprovados.css",
      "src/modulos/aprovados/convocacao.css",
    ])
      expect(semComentarios(ler(caminho))).not.toMatch(/grid-auto-rows/);
  });

  it("Editais e Lista de aprovados usam o Kpi de src/ui (sem KPI próprio)", () => {
    for (const caminho of [
      "src/modulos/editais/painel-operacional.jsx",
      "src/modulos/aprovados/aba-aprovados.jsx",
      "src/modulos/aprovados/aba-convocacao.jsx",
    ]) {
      const jsx = ler(caminho);
      expect(jsx, caminho).toContain("<GradeDeKpis");
      expect(jsx, caminho).toContain("<Kpi");
    }
  });
});

describe("Acessos: nomes longos com reticências", () => {
  const css = ler("src/modulos/acessos/acessos.css");

  it("o nome da pessoa (botão e, nas contas desativadas, o strong) para em reticências", () => {
    for (const seletor of [
      ".acessos-nome",
      ".acessos-pessoa-textos > strong",
    ]) {
      const d = regra(css, seletor);
      expect(d.display).toBe("block");
      expect(d["max-width"]).toBe("100%");
      expect(d.overflow).toBe("hidden");
      expect(d["text-overflow"]).toBe("ellipsis");
      expect(d["white-space"]).toBe("nowrap");
    }
    expect(regra(css, ".acessos-pessoa")["min-width"]).toBe("0");
    expect(regra(css, ".acessos-pessoa-textos")["min-width"]).toBe("0");
  });

  it("o nome inteiro fica no title", () => {
    const usuarios = ler("src/modulos/acessos/aba-usuarios.jsx");
    expect(usuarios).toContain(
      "titulo={`Abrir o acesso de ${usuario.nome || usuario.email}`}",
    );
    expect(usuarios).toContain(
      "title={nomeDaCoordenacao || coordenacao || undefined}",
    );
    expect(ler("src/modulos/acessos/contas-desativadas.jsx")).toContain(
      "<strong title={conta.nome || conta.email}>",
    );
  });
});

describe("Aparência: cartões da galeria", () => {
  const css = ler("src/modulos/configuracoes/configuracoes.css");

  it("o cartão prende a coluna à própria largura e não estica a miniatura", () => {
    const cartao = regra(css, ".config-galeria__cartao");
    expect(cartao["grid-template-columns"]).toBe("minmax(0, 1fr)");
    expect(cartao["align-content"]).toBe("start");
    expect(regra(css, ".config-galeria__miniatura").width).toBe("100%");
    expect(
      regra(
        css,
        '.config-galeria__grade[data-formato="paisagem"] .config-galeria__miniatura',
      )["aspect-ratio"],
    ).toBe("16 / 9");
  });

  it("cartões iguais na grade", () => {
    expect(regra(css, ".config-galeria__grade")["grid-auto-rows"]).toBe("1fr");
  });
});

describe("Operação: botão Restaurar do histórico", () => {
  it("leva a classe que o põe na linha de baixo, na largura toda, no celular", () => {
    expect(ler("src/modulos/configuracoes/configuracoes.jsx")).toContain(
      'className="btn secondary config-history-restore"',
    );
    const css = ler("src/modulos/configuracoes/configuracoes.css");
    const d = regra(css, ".config-history-restore");
    expect(d["grid-column"]).toBe("1/-1");
    expect(d["justify-self"]).toBe("stretch");
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Testes de invariante visual, no mesmo espírito de `shell-invariants.test.js`:
  leem o código-fonte em vez de montar a aplicação. Isso evita mocks de Supabase
  para verificar coisas que não dependem de dado nenhum — uma cor, um tamanho,
  um atributo de acessibilidade.
*/

const semComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const nucleoCss = semComentarios(
  readFileSync("src/styles/nucleo-operational-enhancements.css", "utf8"),
);
const mapaCss = semComentarios(
  readFileSync("src/styles/health-map-workspace.css", "utf8"),
);
const nucleoJs = readFileSync("src/modules/nucleo-operational.js", "utf8");

/*
  Corpos de TODOS os blocos cujo grupo de seletores contém exatamente
  `seletor`. Um mesmo seletor costuma aparecer mais de uma vez — a legenda do
  mapa, por exemplo, recebe a borda num grupo e a cor noutro — e quem lê o
  ficheiro precisa de os ver todos.
*/
function blocos(css, seletor) {
  const achados = css.split("}").filter((parte) => {
    const chave = parte.indexOf("{");
    if (chave === -1) return false;
    return parte
      .slice(0, chave)
      .split(",")
      .map((item) => item.trim())
      .includes(seletor);
  });
  if (!achados.length) throw new Error(`seletor não encontrado: ${seletor}`);
  return achados.map((parte) => parte.slice(parte.indexOf("{") + 1));
}

/** Último valor declarado para a propriedade — que é o que a cascata aplica. */
function valor(css, seletor, propriedade) {
  const padrao = new RegExp(`(?:^|;)\\s*${propriedade}\\s*:\\s*([^;]+)`);
  const declarados = blocos(css, seletor)
    .map((corpo) => corpo.match(padrao)?.[1]?.trim())
    .filter(Boolean);
  if (!declarados.length)
    throw new Error(`${propriedade} não declarada em ${seletor}`);
  return declarados[declarados.length - 1];
}

const canal = (valor) => {
  const c = valor / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminancia = (hex) => {
  const limpo = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(limpo.slice(i, i + 2), 16));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
};

/** Razão de contraste da WCAG 2.1. Texto normal pede 4.5:1 para o nível AA. */
const contraste = (frente, fundo) => {
  const [claro, escuro] = [luminancia(frente), luminancia(fundo)].sort(
    (a, b) => b - a,
  );
  return (claro + 0.05) / (escuro + 0.05);
};

const AA = 4.5;
const BRANCO = "#ffffff";

describe("convenção do tema escuro", () => {
  /*
    O tema é um atributo — `data-theme="dark"` no `<html>` — e existe o espelho
    vivo `body.dark-mode`. A classe `dark`, que nada neste repositório adiciona,
    já custou 38 seletores que nunca chegaram a valer.
  */
  it("nenhuma folha volta a depender da classe `dark`, que ninguém aplica", () => {
    const culpadas = readdirSync("src/styles")
      .filter((nome) => nome.endsWith(".css"))
      .filter((nome) =>
        /(?:^|[\s,>])(?:html|body)\.dark(?![-\w])/.test(
          readFileSync(`src/styles/${nome}`, "utf8"),
        ),
      );
    expect(culpadas).toEqual([]);
  });
});

describe("contraste dos KPIs da Equipe Núcleo", () => {
  it("o rótulo passa o AA sobre o cartão claro", () => {
    const cor = valor(nucleoCss, ".nucleo-kpi-card small", "color");
    expect(contraste(cor, BRANCO)).toBeGreaterThanOrEqual(AA);
  });

  /*
    Aqui verifica-se o valor, não o rótulo. No escuro o rótulo é pintado por
    `html[data-theme="dark"] .app small` de `config-page.css`, com `!important`;
    qualquer regra nossa perderia para ele. Afirmar a cor do rótulo a partir
    deste ficheiro seria afirmar algo que a tela não mostra.
  */
  it("o valor passa o AA sobre o cartão escuro", () => {
    const cor = valor(
      nucleoCss,
      'html[data-theme="dark"] .nucleo-kpi-card',
      "color",
    );
    const fundo = valor(
      nucleoCss,
      'html[data-theme="dark"] .nucleo-kpi-card',
      "background",
    );
    expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(AA);
  });
});

describe("legibilidade e contraste dos mapas", () => {
  it("nenhum texto do workspace fica abaixo de 10px", () => {
    const miudos = [...mapaCss.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)]
      .map((achado) => Number(achado[1]))
      .filter((tamanho) => tamanho < 10);
    expect(miudos).toEqual([]);
  });

  it("o estado vazio passa o AA sobre o painel claro", () => {
    const cor = valor(mapaCss, ".health-map-empty", "color");
    expect(contraste(cor, BRANCO)).toBeGreaterThanOrEqual(AA);
  });

  /*
    Só o tema claro: no escuro o tipo da unidade é pintado pelo `!important`
    de `config-page.css`, e esta folha não tem como o decidir.
  */
  it("o tipo da unidade passa o AA sobre o painel claro", () => {
    const cor = valor(mapaCss, ".health-map-unit small", "color");
    expect(contraste(cor, BRANCO)).toBeGreaterThanOrEqual(AA);
  });

  it("legenda, dica e vazio passam o AA sobre o painel escuro", () => {
    const cor = valor(
      mapaCss,
      '[data-theme="dark"] .health-map-detail-legend',
      "color",
    );
    const fundo = valor(
      mapaCss,
      '[data-theme="dark"] .health-map-pane',
      "background",
    );
    expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(AA);
  });

  it("a tarja de seção passa o AA sobre o painel escuro", () => {
    const cor = valor(
      mapaCss,
      '[data-theme="dark"] .health-map-pane__eyebrow',
      "color",
    );
    const fundo = valor(
      mapaCss,
      '[data-theme="dark"] .health-map-pane',
      "background",
    );
    expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(AA);
  });
});

describe("estados do painel operacional", () => {
  it("tem os três estados, não só o de erro", () => {
    expect(nucleoJs).toContain("nucleo-summary-loading");
    expect(nucleoJs).toContain("nucleo-summary-empty");
    expect(nucleoJs).toContain("nucleo-summary-error");
  });

  it("o erro oferece uma ação e não despeja a mensagem do banco na tela", () => {
    expect(nucleoJs).toContain("nucleo-summary-retry");
    expect(nucleoJs).not.toContain("esc(error?.message");
    // O detalhe técnico continua a existir — no console, não na interface.
    expect(nucleoJs).toContain("console.error");
  });

  it("o estado vazio explica o contexto em vez de dizer só que está vazio", () => {
    expect(nucleoJs).toContain("Nenhum edital ativo na Equipe Núcleo");
    expect(nucleoJs).not.toContain("Nenhum resultado");
  });

  it("a grade não inventa zeros enquanto o resumo não chegou", () => {
    expect(nucleoJs).toContain('state.status === "idle"');
  });
});

describe("acessibilidade do painel operacional", () => {
  it("o filtro ativo é anunciado por `aria-pressed`, não só pela cor", () => {
    expect(nucleoJs).toContain("aria-pressed=");
    expect(nucleoJs).toContain("is-active");
  });

  it("a tarja de filtro ativo é uma região de status", () => {
    expect(nucleoJs).toContain(
      'class="nucleo-active-alert-filter" role="status"',
    );
  });

  it("os ícones decorativos ficam fora da árvore de acessibilidade", () => {
    expect(nucleoJs).toContain('aria-hidden="true"');
  });
});

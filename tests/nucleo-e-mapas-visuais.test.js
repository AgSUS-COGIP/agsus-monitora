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
const seletorCss = semComentarios(
  readFileSync("src/styles/map-base-layer-switcher.css", "utf8"),
);

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
  return resolverToken(declarados[declarados.length - 1]);
}

/*
  Cor em token (`var(--text-secondary)`) vira o hex do tema claro em tokens.css,
  para o contraste continuar sendo calculado, não suposto.
*/
const tokensCss = semComentarios(readFileSync("src/styles/tokens.css", "utf8"));
const raizClara = tokensCss.slice(0, tokensCss.indexOf('[data-theme="dark"]'));
function resolverToken(valorCss) {
  const nome = valorCss.match(/^var\(\s*(--[\w-]+)/)?.[1];
  if (!nome) return valorCss;
  const achado = raizClara.match(new RegExp(`${nome}\\s*:\\s*([^;]+);`));
  if (!achado) throw new Error(`token ${nome} não existe em tokens.css`);
  return achado[1].trim();
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

describe("seletor de camada Mapa/Satélite", () => {
  /*
    O botão selecionado é o que mais precisa de se ler, e o anel de foco é o
    que diz a quem navega por teclado onde está. Os dois falhavam no escuro:
    3.78:1 no texto e 2.47:1 no anel.
  */
  const ativoEscuro = () =>
    valor(
      seletorCss,
      '[data-theme="dark"] .agsus-basemap-switcher__button[aria-pressed="true"]',
      "background",
    );

  it("o botão ativo passa o AA no tema escuro", () => {
    const cor = valor(
      seletorCss,
      '[data-theme="dark"] .agsus-basemap-switcher__button[aria-pressed="true"]',
      "color",
    );
    expect(contraste(cor, ativoEscuro())).toBeGreaterThanOrEqual(AA);
  });

  it("o botão ativo passa o AA no tema claro", () => {
    const fundo = valor(
      seletorCss,
      '.agsus-basemap-switcher__button[aria-pressed="true"]',
      "background",
    );
    const cor = valor(
      seletorCss,
      '.agsus-basemap-switcher__button[aria-pressed="true"]',
      "color",
    );
    expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(AA);
  });

  /*
    O anel de foco não é verificável por uma cor fixa: quem o governa é o
    `!important` de `app.css`, e a cor que este ficheiro escrevesse ficaria
    inerte. As três propriedades abaixo são o que de facto o torna visível.

    `currentColor` amarra o anel à cor do texto do botão, que os dois testes
    acima já obrigam a passar o AA contra o fundo desse botão — não há como o
    anel ficar invisível sem que o rótulo fique primeiro.

    O deslocamento negativo mantém o anel dentro do botão. Com deslocamento
    positivo ele é recortado pelo `overflow: hidden` do container e o que
    sobra cai sobre os ladrilhos do mapa, cuja cor ninguém controla.
  */
  it("o anel de foco herda a cor do texto e fica dentro do botão", () => {
    const regra = blocos(
      seletorCss,
      ".agsus-basemap-switcher__button:focus-visible",
    ).join(" ");
    expect(regra).toMatch(/outline:[^;]*currentColor/);
    expect(regra).toMatch(/outline-offset:\s*-\d/);
  });

  it("o anel de foco vence o !important global de app.css", () => {
    const regra = blocos(
      seletorCss,
      ".agsus-basemap-switcher__button:focus-visible",
    ).join(" ");
    expect(regra).toMatch(/outline:[^;]*!important/);
    expect(regra).toMatch(/outline-offset:[^;]*!important/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guard = readFileSync("src/modules/map-guard.js", "utf8");
const app = readFileSync("src/modules/legacy-app.js", "utf8");
const css = readFileSync("src/styles/health-map-workspace.css", "utf8");

const semComentarios = (fonte) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/*
  A bandeira de visão geral estava sempre falsa.

  O `fitBounds` do Leaflet termina chamando `this.setView(...)`, que aqui é o
  `setGuardedView` — e ele zera `__agsusOverviewMode` para detectar quando a
  pessoa move o mapa. Gravando a bandeira **antes** do fit, todo enquadramento a
  ligava e o próprio enquadramento a desligava em seguida.

  Consequência: `emOverview()` nunca era verdadeiro, o `ResizeObserver` se
  desconectava na primeira observação e o mapa jamais voltava a enquadrar depois
  de o card mudar de largura. Medido no navegador antes da correção: as três
  medições saíam com `overview=false` e bounds idênticos entre elas.
*/
describe("a bandeira de visão geral sobrevive ao próprio enquadramento", () => {
  const posicaoDaEscrita = (nomeDaFuncao, fim) => {
    const corpo = guard.slice(guard.indexOf(nomeDaFuncao), guard.indexOf(fim));
    return {
      escrita: corpo.indexOf("__agsusOverviewMode = "),
      fit: corpo.search(/original(Fit|FlyTo)Bounds\(/),
      corpo,
    };
  };

  it("fitBounds grava a bandeira depois de enquadrar", () => {
    const { escrita, fit } = posicaoDaEscrita(
      "function fitGuardedBounds",
      "if (originalFlyToBounds)",
    );
    expect(fit).toBeGreaterThan(-1);
    expect(escrita).toBeGreaterThan(fit);
  });

  it("fitBrazilOverview grava a bandeira depois de enquadrar", () => {
    const { escrita, fit } = posicaoDaEscrita(
      "const fitBrazilOverview",
      "map.whenReady",
    );
    expect(fit).toBeGreaterThan(-1);
    expect(escrita).toBeGreaterThan(fit);
  });

  /*
    `flyToBounds` anima: o `setView` interno acontece depois do retorno, então
    a gravação é adiada em vez de simplesmente reordenada.
  */
  it("flyToBounds adia a gravação para depois da animação", () => {
    const corpo = guard.slice(
      guard.indexOf("function flyToGuardedBounds"),
      guard.indexOf("if (originalFlyTo)"),
    );
    expect(corpo).toMatch(
      /setTimeout\(\s*\(\)\s*=>\s*\{\s*map\.__agsusOverviewMode = overview;/,
    );
  });

  it("setView continua desligando a bandeira, que é o seu papel", () => {
    const corpo = guard.slice(
      guard.indexOf("function setGuardedView"),
      guard.indexOf("if (originalPanTo)"),
    );
    expect(corpo).toContain("map.__agsusOverviewMode = false;");
  });
});

/*
  Medido no navegador, num card de 1600x518 com a visão Brasil:

    largura cheia      140.6° de longitude visíveis — o país (41.6°) ocupa 30%
    max-width h*1.60    72.9°                                        57%
    max-width h*1.25    57.0°                                        73%
    max-width h*1.05    47.8°                                        87%

  O enquadramento é limitado pela altura, então alargar o card não aumenta o
  país: aumenta o oceano. Pior: com 140.6° visíveis contra um `maxBounds` de
  57.5°, o Leaflet prendia o centro no meio do `maxBounds` (-55.75) e o Brasil
  encostava à esquerda.
*/
describe("a visão Brasil não estica o mapa além do que ele usa", () => {
  it("o mapa tem largura limitada quando não há DSEI selecionado", () => {
    const regra = css.slice(
      css.indexOf(".health-map-detail-layout.sem-selecao #detailMap"),
    );
    expect(regra).toContain("max-width: calc(var(--health-map-height) * 1.25)");
    expect(regra).toContain("margin-inline: auto");
  });

  it("a limitação vale só sem seleção", () => {
    expect(css).not.toMatch(
      /^\.health-map-detail-layout #detailMap\s*\{[^}]*max-width/m,
    );
  });

  it("não usa zoom nem transform para caber", () => {
    const bloco = css.slice(
      css.indexOf(".health-map-detail-layout.sem-selecao"),
      css.indexOf(".health-map-units {"),
    );
    expect(bloco).not.toMatch(/\bzoom\s*:/);
    expect(bloco).not.toMatch(/transform:\s*scale\(/);
  });
});

/*
  `invalidateSize({pan: false})` mantém o canto superior esquerdo: a largura
  nova entra toda à direita e empurra o conteúdo para o lado. O padrão preserva
  o centro.
*/
describe("remedir o mapa não o desloca", () => {
  it("o colapso da coluna preserva o centro", () => {
    const codigo = semComentarios(app);
    const fn = codigo.slice(
      codigo.indexOf("function definirSelecaoDoMapaDetalhado"),
      codigo.indexOf("function resetDetailMap"),
    );
    expect(fn).toContain("invalidateSize");
    expect(fn).not.toContain("pan: false");
  });
});

/*
  O mapa nacional decidia a linha pontilhada pelo campo `fora` do payload, que
  significa "fora da UF da **sede**" — não "fora da abrangência do DSEI". São
  coisas diferentes em 12 dos 34 DSEIs.

  Conferido contra os dados reais de `mapa_saude_indigena_config`: dos 381
  polos, 58 chegam com `fora: true`, e **todos os 58** estão numa UF que consta
  do `ufs` do próprio DSEI — Boca do Acre (AM) no Alto Rio Purus [AC,AM,RO],
  Passo Fundo (RS) no Interior Sul [RS,SC], Goiânia (GO) no Araguaia [GO,MT,TO].
  Eram 58 linhas afirmando uma anomalia territorial inexistente.
*/
describe("o mapa nacional usa a mesma regra do detalhado", () => {
  const codigo = semComentarios(app);
  const bloco = codigo.slice(
    codigo.indexOf("function drawPolos"),
    codigo.indexOf("_layerPolos.addLayer(mk)"),
  );

  it("não decide mais pelo campo `fora` do payload", () => {
    expect(codigo).not.toContain("p.fora");
  });

  it("classifica pelo CNES contra as UFs do DSEI", () => {
    expect(bloco).toContain(
      "classificarVinculoTerritorial(p.uf_cnes ?? p.uf, d.ufs)",
    );
    expect(bloco).toContain('vinculo.vinculo === "externo"');
  });

  /*
    `const seen = {}` aparece três vezes no ficheiro; procurar a partir do zero
    encontrava a primeira, muito antes da sede, e o corte saía vazio.
  */
  it("a sede de referência também sai da regra, não do campo", () => {
    const inicio = codigo.indexOf("const sede =");
    expect(inicio).toBeGreaterThan(-1);
    const sede = codigo.slice(
      inicio,
      codigo.indexOf("const seen = {}", inicio),
    );
    expect(sede).toContain("classificarVinculoTerritorial");
  });

  it("a linha avisa que não é trajeto, como no mapa detalhado", () => {
    expect(bloco).toContain("bindTooltip(TOOLTIP_DA_LINHA");
  });

  it("o texto não afirma mais 'em outro estado'", () => {
    expect(codigo).not.toContain("em outro estado");
    expect(codigo).toContain("fora das UFs de abrang");
  });
});

/*
  A legenda do mapa detalhado descrevia bolinhas redondas para os quatro tipos,
  distinguindo-os só pela cor — enquanto os marcadores já eram círculo, casa,
  cruz e losango desde que ganharam forma própria. Além de não descrever o mapa,
  devolvia à cor o papel de única informação.
*/
describe("a legenda descreve os marcadores que existem", () => {
  const modulo = readFileSync("src/modules/vinculos-territoriais.js", "utf8");
  const main = readFileSync("src/main.js", "utf8");
  const html = readFileSync("index.html", "utf8");

  it("as bolinhas redondas saíram do HTML e do CSS", () => {
    expect(html).not.toContain("health-map-dot");
    expect(css).not.toContain("health-map-dot");
  });

  it("a legenda é gerada pela mesma função que desenha os marcadores", () => {
    const fn = modulo.slice(
      modulo.indexOf("export function htmlDaLegenda"),
      modulo.indexOf("export function aplicarLegendaDoMapaDetalhado"),
    );
    expect(fn).toContain("svgDaForma(forma, cor)");
    expect(fn).toContain("TIPOS_DA_LEGENDA");
  });

  it("cobre os quatro tipos, cada um com forma própria", () => {
    const tipos = modulo
      .slice(
        modulo.indexOf("export const TIPOS_DA_LEGENDA"),
        modulo.indexOf("export const ESTILO_DA_LINHA"),
      )
      .match(/"(\w+)"/g);
    expect(tipos).toEqual(['"polo"', '"casai"', '"ubsi"', '"unit"']);
  });

  /*
    As cores da legenda têm de ser as mesmas que `detailUnitType` dá aos
    marcadores; se uma das duas mudar sozinha, a legenda passa a mentir.
  */
  /*
    A lista sai do próprio módulo em vez de ser fixada aqui: escrita à mão, ela
    quebrava a cada troca de cor sem que nada estivesse errado — foi o que
    aconteceu ao substituir o verde do UBSI.
  */
  it("as cores batem com as dos marcadores", () => {
    const tipoDoMarcador = app.slice(
      app.indexOf("function detailUnitType"),
      app.indexOf("function detailRecordsForDsei"),
    );
    const cores = [...modulo.matchAll(/cor: "(#[0-9a-f]{6})"/g)].map(
      (m) => m[1],
    );
    expect(cores).toHaveLength(4);
    for (const cor of cores) {
      expect(tipoDoMarcador, `${cor} sumiu dos marcadores`).toContain(cor);
    }
  });

  it("a linha pontilhada é explicada", () => {
    const fn = modulo.slice(modulo.indexOf("export function htmlDaLegenda"));
    expect(fn).toContain("vínculo fora das UFs do DSEI");
    expect(css).toContain(".health-map-legenda-linha");
  });

  it("é aplicada no arranque", () => {
    expect(main).toContain("aplicarLegendaDoMapaDetalhado()");
  });
});

/*
  A cor do UBSI competia com o mapa.

  Amostrando os tiles reais do OSM sobre a área do DSEI Potiguara: terra
  #f2efe9 (86.2% dos pixels), vegetação #add19e (2.2%), água #aad3df (1%).

  O verde #189b63 dava 2.10:1 de contraste contra a vegetação — abaixo do
  mínimo de 3:1 da WCAG para elementos gráficos — e ficava a 52° de matiz dela.
  O violeta #6d28d9 dá 4.19:1 e 161°.
*/
describe("as cores dos marcadores se separam do mapa", () => {
  const modulo = readFileSync("src/modules/vinculos-territoriais.js", "utf8");

  const canal = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const linear = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const luminancia = (h) => {
    const [r, g, b] = canal(h);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const contraste = (a, b) => {
    const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const matiz = (h) => {
    const [r, g, b] = canal(h).map((v) => v / 255);
    const mx = Math.max(r, g, b);
    const d = mx - Math.min(r, g, b);
    if (!d) return 0;
    const t =
      mx === r
        ? ((g - b) / d) % 6
        : mx === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
    return (t * 60 + 360) % 360;
  };
  const distanciaDeMatiz = (a, b) => {
    const d = Math.abs(matiz(a) - matiz(b));
    return Math.min(d, 360 - d);
  };

  const VEGETACAO = "#add19e";
  const cores = [...modulo.matchAll(/cor: "(#[0-9a-f]{6})"/g)].map((m) => m[1]);

  it("o verde que se dissolvia na vegetação saiu", () => {
    expect(cores).not.toContain("#189b63");
    expect(cores).toContain("#6d28d9");
  });

  it("o UBSI passa do mínimo de 3:1 contra a vegetação", () => {
    expect(contraste("#6d28d9", VEGETACAO)).toBeGreaterThan(3);
    // O verde antigo não passava, e é por isso que ele saiu.
    expect(contraste("#189b63", VEGETACAO)).toBeLessThan(3);
  });

  it("nenhum marcador fica perto do matiz da vegetação", () => {
    for (const cor of cores) {
      expect(
        distanciaDeMatiz(cor, VEGETACAO),
        `${cor} está perto do verde do mapa`,
      ).toBeGreaterThan(60);
    }
  });

  it("os quatro se distinguem entre si", () => {
    expect(cores).toHaveLength(4);
    for (let i = 0; i < cores.length; i += 1) {
      for (let j = i + 1; j < cores.length; j += 1) {
        expect(
          distanciaDeMatiz(cores[i], cores[j]),
          `${cores[i]} e ${cores[j]} têm matizes próximos`,
        ).toBeGreaterThan(40);
      }
    }
  });

  it("a cor da legenda e a do marcador continuam a mesma", () => {
    const tipoDoMarcador = app.slice(
      app.indexOf("function detailUnitType"),
      app.indexOf("function detailRecordsForDsei"),
    );
    for (const cor of cores) {
      expect(tipoDoMarcador, `${cor} não está nos marcadores`).toContain(cor);
    }
  });
});

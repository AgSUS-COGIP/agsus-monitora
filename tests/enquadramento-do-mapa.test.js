import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FORMAS,
  TIPOS_DA_LEGENDA,
  formaDoTipo,
} from "../src/lib/mapa-saude-indigena/formas.ts";

const guard = readFileSync("src/modules/map-guard.js", "utf8");
const nacional = readFileSync(
  "src/modulos/mapa-saude-indigena/mapa-nacional.jsx",
  "utf8",
);
const doDsei = readFileSync(
  "src/modulos/mapa-saude-indigena/mapa-do-dsei.jsx",
  "utf8",
);
const cssDoModulo = readFileSync(
  "src/modulos/mapa-saude-indigena/mapa-saude-indigena.css",
  "utf8",
);
const css = readFileSync(
  "src/modulos/mapa-de-projetos/mapa-de-projetos.css",
  "utf8",
);
const projetosJsx = readFileSync(
  "src/modulos/mapa-de-projetos/mapa-de-projetos.tsx",
  "utf8",
);
// A moldura, o topo e a lista comuns aos dois mapas nacionais.
const painelComum = readFileSync(
  "src/modulos/mapa-saude-indigena/painel-do-mapa.tsx",
  "utf8",
);

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
  O `max-width: altura * 1.25` que vivia aqui encolhia o `#detailMap` dentro de
  um card que continuava largo. Em produção, a 1920, sobravam cerca de 310px de
  card branco à esquerda do mapa — a faixa que motivou esta branch.

  Ele existia para esconder outro problema, que não era de CSS: o `map-guard`
  recortava os azulejos a NAVEGACAO_BOUNDS (57.5° de longitude), e um card de
  1642x480 precisa de 171.6° para enquadrar os 39° de latitude do Brasil.
  Medido em `bench/prototipo-workspace.html`, contando os `<img>` no DOM:

    com o recorte, card a toda a largura ....... 33% da área com azulejo
    com o recorte, mapa a 696px + painel ....... 79%
    sem o recorte (só `noWrap`) ................ 100%

  Com o recorte fora, o container pode preencher o card: o enquadramento volta
  a ser trabalho do `fitBounds`, com padding e `maxZoom`, que é onde pertence.
*/
describe("o container do mapa preenche o card", () => {
  it("nenhum dos mapas é limitado por max-width nem centrado", () => {
    /* Sem comentários: os cabeçalhos citam as regras que removeram. */
    for (const fonte of [css, cssDoModulo]) {
      const regras = semComentarios(fonte);
      expect(regras).not.toMatch(
        /#(detailMap|map|mapaDosProjetos)[^{]*\{[^}]*max-width:\s*calc/,
      );
      expect(regras).not.toContain("margin-inline: auto");
    }
  });

  it("o mapa de Projetos e os da Saúde Indígena ocupam a largura toda", () => {
    // O de Projetos usa a mesma moldura e o mesmo contêiner do nacional da Saúde Indígena.
    expect(projetosJsx).toContain("<MolduraDoMapa");
    expect(nacional).toContain("<MolduraDoMapa");
    expect(painelComum).toContain('className="mapa-si-mapa"');
    expect(painelComum).toContain('className="mapa-si-moldura"');
    expect(css).not.toMatch(/.mapa-si-mapa|#mapaDosProjetos/);
    const modulo = cssDoModulo.slice(
      cssDoModulo.indexOf(".mapa-si-mapa {"),
      cssDoModulo.indexOf("}", cssDoModulo.indexOf(".mapa-si-mapa {")),
    );
    expect(modulo).toContain("width: 100%");
    expect(modulo).toContain("height: 100%");
  });

  it("não usa zoom nem transform para caber", () => {
    for (const fonte of [css, cssDoModulo]) {
      expect(fonte).not.toMatch(/\bzoom\s*:/);
      expect(fonte).not.toMatch(/transform:\s*scale\(/);
    }
  });
});

describe("as cores dos marcadores se separam do mapa", () => {
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
  // A sede não tem matiz para comparar. Ver os dois casos no fim deste bloco.
  const CINZA_DA_SEDE = "#1f2937";
  const cores = TIPOS_DA_LEGENDA.map((tipo) => FORMAS[tipo].cor);

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

  /*
    O grafite da sede fica de fora desta conta, e não por conveniência: ele
    quase não tem croma, e distância de matiz entre um cinzento e uma cor não
    mede nada. O que o distingue é outra coisa — ser o único marcador sem cor —,
    e isso é medido no caso seguinte.
  */
  it("as quatro cores se distinguem entre si", () => {
    const coloridas = cores.filter((c) => c !== CINZA_DA_SEDE);
    expect(coloridas).toHaveLength(4);
    for (let i = 0; i < coloridas.length; i += 1) {
      for (let j = i + 1; j < coloridas.length; j += 1) {
        expect(
          distanciaDeMatiz(coloridas[i], coloridas[j]),
          `${coloridas[i]} e ${coloridas[j]} têm matizes próximos`,
        ).toBeGreaterThan(40);
      }
    }
  });

  /*
    Os quatro matizes existentes estão em 38°, 355°, 263° e 188°, com o par mais
    próximo a 43°. Encaixar um quinto sem colidir obrigaria a ir ao verde, que é
    onde a vegetação do mapa já está. A sede resolve isso não tendo cor.
  */
  it("a sede é o único marcador sem cor, e é assim que se distingue", () => {
    const croma = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    };
    expect(croma(CINZA_DA_SEDE)).toBeLessThan(0.1);
    for (const cor of cores.filter((c) => c !== CINZA_DA_SEDE)) {
      expect(croma(cor), `${cor} devia ser uma cor`).toBeGreaterThan(0.4);
    }
  });

  it("a cor da legenda e a do marcador continuam a mesma", () => {
    for (const tipo of TIPOS_DA_LEGENDA)
      expect(formaDoTipo(tipo).cor, tipo).toBe(FORMAS[tipo].cor);
  });
});

/*
  NENHUM DESENHO INVENTA COORDENADA.

  O selo dos DSEIs que partilham sede era posto com
  `layerPointToLatLng(centro.add(L.point(18, -18)))`. Converter 18px em graus dá
  1.88° na visão nacional — 209 km — e o selo dos dois distritos de Boa Vista
  (2.8563, -60.6527, Roraima) aparecia em 4.4209, -59.0849, dentro da Guiana.
  Medido na aplicação a 15/09/2026.

  O leque é a única exceção, e é uma exceção declarada: ele afasta em pixels
  mas desenha uma linha até à coordenada verdadeira, dizendo que aquilo é um
  chamamento e não um sítio.
*/
describe("o mapa não inventa coordenadas", () => {
  // O leque dos mapas nacionais (Saúde Indígena e Projetos) mora no leaflet.js comum.
  const comum = readFileSync(
    "src/modulos/mapa-saude-indigena/leaflet.js",
    "utf8",
  );
  const codigo =
    semComentarios(nacional) + semComentarios(doDsei) + semComentarios(comum);

  it("não cria selo numérico para DSEIs que compartilham sede", () => {
    expect(codigo).not.toContain("mapa-cluster--sede");
    expect(codigo).not.toContain("DSEIs com a mesma sede");
    expect(codigo).not.toContain("mapa-cluster");
  });

  it("todo deslocamento visual preserva uma linha até a coordenada real", () => {
    expect(codigo.match(/layerPointToLatLng/g) || []).toHaveLength(2);
    // Unidades do DSEI que caem a poucos pixels: leque com traço até o ponto.
    expect(semComentarios(doDsei)).toContain(
      "L.polyline([[grupo.lat, grupo.lon], destino]",
    );
    // Sedes no mesmo pixel (Boa Vista): leque com traço e o ponto real desenhado.
    const leque = semComentarios(comum);
    expect(semComentarios(nacional)).toContain("criarLeque(L, novo, dsei)");
    expect(leque).toContain("L.polyline([[lat, lon], destino]");
    expect(leque).toContain("L.circleMarker([lat, lon]");
  });
});

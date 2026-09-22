import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  estiloDaFase,
  faseDaTerra,
} from "../src/modules/indigenous-territories-layer.js";

/*
  UMA TERRA HOMOLOGADA E UMA EM PROCESSO NÃO SÃO A MESMA COISA

  O mapa pintava as 665 com a mesma cor. Mas a fase é o estado jurídico da
  terra, e no catálogo da Funai elas repartem-se assim:

      494  Regularizada      limite definitivo, registrada em cartório
       17  Homologada        limite definitivo, homologado por decreto
       73  Declarada         limite definido; o processo continua
       45  Delimitada        idem
       28  Encaminhada RI    idem
        8  Em Estudo         sem limite definido

  Para quem planeia atendimento isso muda tudo: um limite que ainda pode mudar
  não é o mesmo que um limite que não muda mais.
*/
describe("a que família pertence cada fase", () => {
  it("regularizada e homologada têm limite definitivo", () => {
    expect(faseDaTerra({ fase_ti: "Regularizada" })).toBe("definitiva");
    expect(faseDaTerra({ fase_ti: "Homologada" })).toBe("definitiva");
  });

  it("declarada, delimitada e encaminhada continuam em processo", () => {
    expect(faseDaTerra({ fase_ti: "Declarada" })).toBe("em_processo");
    expect(faseDaTerra({ fase_ti: "Delimitada" })).toBe("em_processo");
    expect(faseDaTerra({ fase_ti: "Encaminhada RI" })).toBe("em_processo");
  });

  it("em estudo é a terceira família, e tem desenho próprio", () => {
    expect(faseDaTerra({ fase_ti: "Em Estudo" })).toBe("em_estudo");
  });

  it("não se perde por acento nem por caixa", () => {
    expect(faseDaTerra({ fase_ti: "regularizada" })).toBe("definitiva");
    expect(faseDaTerra({ fase_ti: "ENCAMINHADA RI" })).toBe("em_processo");
  });

  /*
    Sem fase declarada desenha-se como definitiva. Dizer "ainda em processo"
    sobre uma terra que talvez esteja regularizada é afirmar mais do que se
    sabe, e na direção que pesa contra quem lá vive.
  */
  it("sem fase não se presume processo", () => {
    expect(faseDaTerra({})).toBe("desconhecida");
    expect(faseDaTerra(null)).toBe("desconhecida");
    expect(estiloDaFase("desconhecida", false).dashArray).toBeNull();
  });

  /*
    O contrário do caso de cima, e igualmente deliberado: só `Regularizada` e
    `Homologada` são definitivas por nome. Uma fase que a Funai venha a publicar
    — `Interditada`, por exemplo, que existe para povos isolados — entra como
    em processo. Errar para o lado de "ainda não é definitiva" é errar para o
    lado que não promete a ninguém um limite que não existe.
  */
  it("fase desconhecida entra como em processo, nunca como definitiva", () => {
    expect(faseDaTerra({ fase_ti: "Interditada" })).toBe("em_processo");
  });
});

describe("o desenho de cada família", () => {
  it("a definitiva é traço cheio", () => {
    expect(estiloDaFase("definitiva", false).dashArray).toBeNull();
  });

  /*
    Tracejado porque uma linha interrompida é como um limite provisório se
    desenha em cartografia desde sempre — e porque a diferença tem de ser
    visível também para quem não distingue as duas tonalidades de magenta.
  */
  it("a que está em processo é tracejada e mais clara", () => {
    const processo = estiloDaFase("em_processo", false);
    const definitiva = estiloDaFase("definitiva", false);
    expect(processo.dashArray).toBeTruthy();
    expect(processo.fillOpacity).toBeLessThan(definitiva.fillOpacity);
    expect(processo.color).not.toBe(definitiva.color);
  });

  it("sobre satélite as duas engrossam o traço e aliviam o preenchimento", () => {
    for (const fase of ["definitiva", "em_processo"]) {
      const comum = estiloDaFase(fase, false);
      const satelite = estiloDaFase(fase, true);
      expect(satelite.weight).toBeGreaterThanOrEqual(comum.weight);
      expect(satelite.fillOpacity).toBeLessThan(comum.fillOpacity);
    }
  });

  /*
    As duas continuam magenta pela mesma razão de sempre: nada na paisagem é
    magenta, e não colide com o azul da camada de DSEI. O que muda é o valor.
  */
  it("as duas continuam na mesma matiz", () => {
    const matiz = (hex) => {
      const [r, g, b] = [1, 3, 5].map(
        (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
      );
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
    const diferenca = Math.abs(
      matiz(estiloDaFase("definitiva", false).color) -
        matiz(estiloDaFase("em_processo", false).color),
    );
    expect(Math.min(diferenca, 360 - diferenca)).toBeLessThan(25);
  });
});

describe("contra o catálogo real", () => {
  const catalogo = JSON.parse(
    readFileSync("public/data/terras-indigenas.json", "utf8"),
  );

  it("as três famílias cobrem todas as terras publicadas", () => {
    const por = new Map();
    for (const f of catalogo.features) {
      const k = faseDaTerra(f.properties);
      por.set(k, (por.get(k) || 0) + 1);
    }
    expect(por.get("desconhecida") ?? 0).toBe(0);
    expect(por.get("definitiva")).toBeGreaterThan(400);
    expect(por.get("em_processo")).toBeGreaterThan(100);
  });
});

/*
  Legenda que descreve menos do que o mapa mostra ensina a procurar a coisa
  errada. Foi assim que o quadrado ficou vermelho enquanto o mapa desenhava
  verde, e depois verde enquanto o mapa desenhava magenta.
*/
describe("a legenda descreve as três", () => {
  const app = readFileSync("src/modules/legacy-app.js", "utf8");

  it("nomeia a homologada, a em processo e a em estudo", () => {
    expect(app).toContain("Terra Indígena homologada ou regularizada");
    expect(app).toContain("Terra Indígena em processo");
    expect(app).toContain("Terra Indígena em estudo");
  });

  it("a amostra da que está em processo é tracejada", () => {
    expect(app).toContain("border:2px dashed #f9a8d4");
  });

  it("as duas legendas do mapa usam a mesma descrição", () => {
    expect(app.match(/\$\{terras\}/g) ?? []).toHaveLength(2);
  });
});

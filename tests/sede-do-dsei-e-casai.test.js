import { describe, expect, it } from "vitest";
import {
  DESENHO_DAS_FORMAS,
  formaDoTipo,
} from "../src/lib/mapa-saude-indigena/formas.js";
import {
  registroDaSede,
  registrosDoDsei,
} from "../src/lib/mapa-saude-indigena/mapa-do-dsei.js";
import {
  chaveDaUnidade,
  indexarVereditos,
  veredictoDaUnidade,
} from "../src/lib/localizacoes-validadas.js";
import { LOCALIZACOES_VALIDADAS } from "../src/lib/localizacoes-validadas-gerado.js";

/*
  A SEDE DO DSEI NÃO TINHA FORMA NENHUMA

  Ela era desenhada — um `circleMarker` azul escrito à mão —, mas fora da tabela
  de formas: sem entrar na legenda, sem forma própria, indistinguível de um polo
  base para quem só via dois círculos. É o ponto administrativo do distrito
  inteiro, e era o único que o mapa não sabia nomear.
*/
describe("a sede tem forma própria", () => {
  it("é estrela, que é como sede se desenha num mapa", () => {
    expect(formaDoTipo("sede").forma).toBe("estrela");
    expect(formaDoTipo("sede").rotulo).toBe("Sede do DSEI");
  });

  it("a estrela tem desenho, e não cai no losango de reserva", () => {
    expect(DESENHO_DAS_FORMAS.estrela).toBeTruthy();
    expect(DESENHO_DAS_FORMAS.estrela).not.toBe(DESENHO_DAS_FORMAS.losango);
  });

  /*
    Os quatro matizes existentes estão em 38°, 355°, 263° e 188°, com o par mais
    próximo a 43°. Encaixar um quinto sem colidir obrigaria a ir ao verde, que é
    onde a vegetação do mapa está. A sede resolve isso não tendo cor — e ser a
    única sem cor é o que a distingue.
  */
  it("é o único marcador sem cor", () => {
    const croma = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    };
    expect(croma(formaDoTipo("sede").cor)).toBeLessThan(0.1);
    for (const chave of ["polo", "casai", "ubsi", "unit"]) {
      expect(croma(formaDoTipo(chave).cor)).toBeGreaterThan(0.4);
    }
  });

  /*
    O marcador dela sai do mesmo caminho dos outros (o tipo, com a cor da
    tabela de formas — uma fonte só, nada a manter em sincronia).
  */
  const dsei = { k: "ALTAMIRA", n: "Altamira", lat: -3.2, lon: -52.2 };

  it("o marcador dela sai do mesmo caminho dos outros", () => {
    const sede = registroDaSede(dsei);
    expect(sede.type.key).toBe("sede");
    expect(sede.type.color).toBe(formaDoTipo("sede").cor);
    expect([sede.lat, sede.lon]).toEqual([-3.2, -52.2]);
  });

  /*
    A sede não é unidade de saúde. Contá-la nos registros do DSEI mudaria os
    totais da dica e criaria um filtro por tipo para uma coisa só.
  */
  it("não entra na contagem das unidades", () => {
    const registros = registrosDoDsei(
      { ...dsei, polos: [{ n: "POLO X", lat: -3.5, lon: -52.5 }] },
      { rede: {}, nac: [] },
    );
    expect(registros.length).toBeGreaterThan(0);
    expect(registros.some((r) => r.type?.key === "sede")).toBe(false);
  });
});

/*
  A CASAI DE ALTAMIRA E O POLO DE ALTAMIRA NÃO SÃO A MESMA COISA

  O canónico de "CASA DE SAUDE INDIGENA DE ALTAMIRA" reduz-se a ALTAMIRA, e o do
  polo da mesma cidade também. A chave era DSEI + canónico, portanto as duas
  colidiam — e chave repetida é ambiguidade, que faz o índice descartar AS DUAS.

  Trinta e três das 34 colisões medidas eram exatamente isto, e por causa delas
  30 das 83 CASAIs do mapa diziam "Localização em validação" tendo veredito.
*/
describe("a chave separa CASAI do resto", () => {
  it("a CASAI e o polo da mesma cidade têm chaves diferentes", () => {
    const daCasai = chaveDaUnidade(
      "ALTAMIRA",
      "CASA DE SAUDE INDIGENA DE ALTAMIRA",
    );
    const doPolo = chaveDaUnidade("ALTAMIRA", "POLO BASE ALTAMIRA");
    expect(daCasai).not.toBe(doPolo);
    expect(daCasai).toBeTruthy();
    expect(doPolo).toBeTruthy();
  });

  it("as grafias da mesma CASAI continuam a convergir", () => {
    expect(chaveDaUnidade("CUIABA", "CASAI CUIABÁ")).toBe(
      chaveDaUnidade("Cuiabá", "CASA DE SAUDE INDIGENA DE CUIABA"),
    );
  });

  it("o índice deixa de descartar as duas por ambiguidade", () => {
    const indice = indexarVereditos([
      {
        dsei: "ALTAMIRA",
        canonico: "ALTAMIRA",
        estado: "coerente",
        motivo: "fonte_unica_no_municipio",
        casai: true,
      },
      {
        dsei: "ALTAMIRA",
        canonico: "ALTAMIRA",
        estado: "conflito",
        motivo: "duas_fontes_discordam_na_uf",
        km: 12,
      },
    ]);
    expect(
      veredictoDaUnidade(
        "ALTAMIRA",
        "CASA DE SAUDE INDIGENA DE ALTAMIRA",
        indice,
      )?.estado,
    ).toBe("coerente");
    expect(
      veredictoDaUnidade("ALTAMIRA", "POLO BASE ALTAMIRA", indice)?.estado,
    ).toBe("conflito");
  });

  /*
    Duas CASAIs com o mesmo nome no mesmo distrito continuam a ser ambiguidade:
    a marca separa tipos, não resolve repetição dentro do mesmo tipo.
  */
  it("repetição dentro do mesmo tipo continua a não decidir nada", () => {
    const indice = indexarVereditos([
      { dsei: "X", canonico: "AAA", estado: "coerente", casai: true },
      { dsei: "X", canonico: "AAA", estado: "erro", casai: true },
    ]);
    expect(veredictoDaUnidade("X", "CASAI AAA", indice)).toBeNull();
  });

  it("o ficheiro do pacote marca as CASAIs", () => {
    const casais = LOCALIZACOES_VALIDADAS.filter((r) => r.casai === true);
    expect(casais.length).toBeGreaterThan(80);
    for (const r of casais) expect(r.canonico).toBeTruthy();
  });
});

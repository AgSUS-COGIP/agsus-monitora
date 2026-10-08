import { describe, expect, it } from "vitest";
import {
  DESENHO_DAS_FORMAS,
  formaDoTipo,
} from "../src/lib/mapa-saude-indigena/formas.ts";
import {
  registroDaSede,
  registrosDoDsei,
} from "../src/lib/mapa-saude-indigena/mapa-do-dsei.js";

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

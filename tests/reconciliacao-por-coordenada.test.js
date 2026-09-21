import { describe, expect, it } from "vitest";
import {
  LIMIAR_MESMO_PONTO_KM,
  reconciliarDsei,
} from "../src/lib/reconciliacao-unidades.js";

/*
  O DSEI CEARÁ MOSTRAVA O MESMO POLO DUAS VEZES

      polo    "PIAUÍ ÁREA II"                              da planilha
      unidade "SAUDE INDIGENA DE URUCUI POLO BASE AREA II" do CNES
              a zero metros um do outro

  O canónico de um é "PIAUI AREA II", o do outro é "SAUDE URUCUI AREA II".
  Não se parecem, e a reconciliação — que compara nomes — deixava os dois.

  Em Minas Gerais o mesmo acontecia por causa de um algarismo romano:
  "MACHACALIS" contra "POLO BASE TIPO II MACHACALIS". O canónico tira POLO,
  BASE e TIPO, mas fica com o "II".

  Coordenada idêntica, no mesmo distrito e com tipo compatível, é prova de
  identidade mais forte do que o nome.
*/
const polo = (nome, lat, lon) => ({ nome, lat, lon, tipo: "polo", cnes: "" });
const unidade = (nome, lat, lon, cnes) => ({
  nome,
  lat,
  lon,
  cnes,
  chave: cnes,
});

describe("a coordenada como última prova de identidade", () => {
  it("une o polo e a unidade que estão no mesmo ponto", () => {
    const { reconciliados, polosSemPar } = reconciliarDsei({
      dseiChave: "CEARA",
      polos: [polo("PIAUÍ ÁREA II", -7.229503, -44.560255)],
      estabelecimentos: [
        unidade(
          "SAUDE INDIGENA DE URUCUI POLO BASE AREA II",
          -7.229503,
          -44.560255,
          "5848210",
        ),
      ],
    });
    expect(reconciliados).toHaveLength(1);
    expect(polosSemPar).toHaveLength(0);
  });

  it("resolve o caso do algarismo romano", () => {
    const { reconciliados } = reconciliarDsei({
      dseiChave: "MG",
      polos: [polo("MACHACALIS", -17.07, -40.72)],
      estabelecimentos: [
        unidade("POLO BASE TIPO II MACHACALIS", -17.07, -40.72, "9341056"),
      ],
    });
    expect(reconciliados).toHaveLength(1);
  });
});

describe("o que a coordenada NÃO autoriza", () => {
  /*
    A CASAI de Marabá está a zero metros do polo de Marabá e continua a ser
    outra coisa. Dos 36 pares medidos nos dados reais, 19 são assim: polo com
    CASAI, com UBSI, com posto. Uni-los apagaria um equipamento do mapa.
  */
  it("não une um polo a uma CASAI no mesmo endereço", () => {
    const { reconciliados, polosSemPar } = reconciliarDsei({
      dseiChave: "GUAMA",
      polos: [polo("MARABA/XIKRIN", -5.36, -49.13)],
      estabelecimentos: [
        unidade(
          "CASA DE SAUDE INDIGENA MARABA CASAI",
          -5.36,
          -49.13,
          "7578865",
        ),
      ],
    });
    expect(reconciliados).toHaveLength(0);
    expect(polosSemPar).toHaveLength(1);
  });

  it("não une um polo a uma UBSI no mesmo endereço", () => {
    const { reconciliados } = reconciliarDsei({
      dseiChave: "POTIGUARA",
      polos: [polo("GOIANINHA", -6.28, -35.0)],
      estabelecimentos: [
        unidade(
          "UBSI JOSE ROBERTO PEREIRA ALDEIA CUMARU",
          -6.28,
          -35.0,
          "7816685",
        ),
      ],
    });
    expect(reconciliados).toHaveLength(0);
  });

  it("não une quando há mais de um candidato — ambiguidade não é prova", () => {
    const { reconciliados, polosSemPar } = reconciliarDsei({
      dseiChave: "X",
      polos: [polo("SEDE", -5, -45)],
      estabelecimentos: [
        unidade("POLO BASE ALFA", -5, -45, "1"),
        unidade("POLO BASE BETA", -5.0001, -45.0001, "2"),
      ],
    });
    expect(reconciliados).toHaveLength(0);
    expect(polosSemPar).toHaveLength(1);
  });

  it("não une para além do limiar", () => {
    // 0,5 grau de latitude são ~55 km, muito além dos 200 m.
    const { reconciliados } = reconciliarDsei({
      dseiChave: "X",
      polos: [polo("SEDE", -5, -45)],
      estabelecimentos: [unidade("POLO BASE LONGE", -5.5, -45, "1")],
    });
    expect(reconciliados).toHaveLength(0);
  });

  it("não reaproveita um estabelecimento que já foi reconciliado pelo nome", () => {
    const { reconciliados, polosSemPar } = reconciliarDsei({
      dseiChave: "X",
      polos: [polo("ALFA", -5, -45), polo("OUTRO NOME", -5, -45)],
      estabelecimentos: [unidade("POLO BASE ALFA", -5, -45, "1")],
    });
    expect(reconciliados).toHaveLength(1);
    expect(polosSemPar).toHaveLength(1);
  });

  it("o limiar é 200 metros", () => {
    expect(LIMIAR_MESMO_PONTO_KM).toBe(0.2);
  });
});

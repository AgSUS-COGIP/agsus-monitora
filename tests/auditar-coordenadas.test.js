import { describe, expect, it } from "vitest";
import {
  NIVEIS,
  casarPoloComCnes,
  classificar,
  coordenadaQuebrada,
  montarRegistros,
} from "../scripts/auditar-coordenadas.mjs";

/*
  A auditoria só vale se as suas próprias regras estiverem certas. Um
  classificador que nunca acusa devolve um relatório limpo e falso, que é pior
  do que não auditar — dá por verificado o que ninguém verificou.
*/

const estab = (nome, cnes, lat, lon, mun, uf) => [
  nome,
  cnes,
  lat,
  lon,
  mun,
  uf,
];

describe("coordenada quebrada", () => {
  it("aceita uma coordenada plausível no Brasil", () => {
    expect(coordenadaQuebrada(-9.9749, -67.8101)).toBeNull();
  });

  /*
    A primeira versão testava a latitude contra a faixa de LONGITUDE e nunca
    acusava troca nenhuma. As duas faixas do Brasil sobrepõem-se entre -33.75 e
    -32.42, e é essa sobreposição que esconde o engano.
  */
  it("acusa latitude e longitude trocadas", () => {
    expect(coordenadaQuebrada(-65.123456, -9.876543)).toBe(
      "latitude e longitude invertidas",
    );
  });

  it("acusa longitude positiva", () => {
    expect(coordenadaQuebrada(-9.97, 67.81)).toMatch(/longitude positiva/);
  });

  it("acusa a ilha nula", () => {
    expect(coordenadaQuebrada(0, 0)).toBe("coordenada zero");
  });

  it("acusa ponto fora do retângulo do país", () => {
    expect(coordenadaQuebrada(-40.5, -60.2)).toBe(
      "fora do retângulo do Brasil",
    );
  });

  it("não inventa problema onde não há coordenada", () => {
    expect(coordenadaQuebrada(null, null)).toBe("sem coordenada");
  });
});

describe("casamento do polo com o CNES", () => {
  const rede = {
    u: [
      estab(
        "POLO BASE SANTA ROSA DO PURUS",
        "1",
        -9.4451,
        -70.4877,
        "Santa Rosa do Purus",
        "AC",
      ),
      estab("POLO BASE ENVIRA", "2", -8.1611, -70.3533, "Feijo", "AC"),
      estab("UBSI JORDAO", "3", -9.1, -71.2, "Jordao", "AC"),
    ],
  };

  it("casa pelo nome do polo e declara a via", () => {
    const r = casarPoloComCnes({ n: "Santa Rosa do Purus", uf: "AC" }, rede);
    expect(r.via).toBe("nome-polo");
    expect(r.registro[1]).toBe("1");
  });

  /*
    Este é o casamento perigoso e o motivo de a auditoria existir. O polo
    "Feijó" não tem nenhum POLO BASE com esse nome; o que existe é um POLO BASE
    ENVIRA situado no município de Feijó. Município (60) mais UF (10) chegam
    exactamente ao limiar de 70, e o polo herda a coordenada de outro polo.
  */
  it("casa só pelo município quando o nome não bate, e marca isso", () => {
    const r = casarPoloComCnes({ n: "Feijo", uf: "AC" }, rede);
    expect(r.via).toBe("municipio-apenas");
    expect(r.registro[0]).toBe("POLO BASE ENVIRA");
    expect(r.score).toBe(70);
  });

  it("não casa quando não há nome nem município parecidos", () => {
    expect(casarPoloComCnes({ n: "Surucucu", uf: "RR" }, rede)).toBeNull();
  });
});

describe("classificação de confiança", () => {
  const payload = {
    lmap: {
      dsei: [
        {
          k: "D",
          n: "D",
          lat: -9.02,
          lon: -68.66,
          sedeuf: "AC",
          ufs: ["AC"],
          polos: [
            { n: "Santa Rosa do Purus", lat: -9.44, lon: -70.48, uf: "AC" },
            { n: "Feijo", lat: -8.16, lon: -70.35, uf: "AC" },
            { n: "Sem Par", lat: -9.11, lon: -69.55, uf: "AC" },
          ],
        },
      ],
    },
    rede_cnes: {
      rede: {
        D: {
          u: [
            estab(
              "POLO BASE SANTA ROSA DO PURUS",
              "1",
              -9.445123,
              -70.487654,
              "Santa Rosa do Purus",
              "AC",
            ),
            estab(
              "POLO BASE ENVIRA",
              "2",
              -8.161111,
              -70.353333,
              "Feijo",
              "AC",
            ),
            estab("UBSI GEMEA", "3", -9.445123, -70.487654, "Jordao", "AC"),
            estab("UBSI FORA", "4", -23.5505, -46.6333, "Sao Paulo", "SP"),
          ],
          c: [],
        },
      },
      nac: [],
    },
  };
  const linhas = classificar(montarRegistros(payload));
  const por = (nome) => linhas.find((l) => l.nome === nome);

  it("o estabelecimento com coordenada própria do CNES é o nível mais alto", () => {
    expect(por("UBSI GEMEA").nivel).toBe(NIVEIS.OFICIAL_ESTABELECIMENTO);
  });

  it("o polo casado pelo nome fica um degrau abaixo", () => {
    expect(por("Santa Rosa do Purus").nivel).toBe(NIVEIS.OFICIAL_CNES);
  });

  it("o polo casado só pelo município é inferido, não oficial", () => {
    const feijo = por("Feijo");
    expect(feijo.nivel).toBe(NIVEIS.INFERIDA);
    expect(feijo.problemas.join(" ")).toMatch(/SÓ pelo município/);
  });

  it("o polo de coordenada arredondada e sem par é aproximação", () => {
    expect(por("Sem Par").nivel).toBe(NIVEIS.APROXIMADA_MUNICIPIO);
  });

  /*
    Dois estabelecimentos distintos no mesmo ponto é achado. O polo partilhar a
    coordenada do registo que o originou não é — é o próprio mecanismo, e
    contá-lo afogaria os achados verdadeiros em ruído.
  */
  it("acusa repetição entre estabelecimentos diferentes", () => {
    expect(por("UBSI GEMEA").duplicadaCom.join(" ")).toMatch(/SANTA ROSA/);
  });

  it("não acusa o polo por partilhar a coordenada da sua própria fonte", () => {
    const polo = por("Santa Rosa do Purus");
    const juntos = polo.duplicadaCom.join(" ");
    // A fonte que lhe deu a coordenada fica de fora...
    expect(juntos).not.toMatch(/POLO BASE SANTA ROSA/);
    // ...mas o terceiro registo no mesmo ponto continua a ser acusado.
    expect(juntos).toMatch(/UBSI GEMEA/);
  });

  it("acusa unidade cuja UF está fora da abrangência do DSEI", () => {
    expect(por("UBSI FORA").problemas.join(" ")).toMatch(/fora da abrangência/);
  });
});

/*
  O que segue cobre o pedido central da segunda rodada da auditoria: achar a
  coordenada que é numericamente impecável e mesmo assim não localiza ninguém.
  Nos dados reais, um único ponto reúne 57 estabelecimentos distintos.
*/
describe("coordenadas plausíveis mas semanticamente suspeitas", () => {
  const pontoColetor = (quantos, lat, lon, municipio) =>
    Array.from({ length: quantos }, (_, i) =>
      estab(`UBSI ALDEIA ${i + 1}`, `90${i}`, lat, lon, municipio, "RR"),
    );

  const payload = {
    lmap: {
      dsei: [
        {
          k: "Y",
          n: "Y",
          lat: 2.8235,
          lon: -60.6758,
          sedeuf: "RR",
          ufs: ["RR", "AM"],
          polos: [
            // Casa pelo nome, mas o registo adotado fica a centenas de km.
            { n: "Marari", lat: -5.9, lon: -67.9, uf: "AM" },
            // Casa pelo nome e fica onde o lmap já dizia.
            { n: "Auaris", lat: 4.0521, lon: -64.4012, uf: "RR" },
          ],
        },
      ],
    },
    rede_cnes: {
      rede: {
        Y: {
          u: [
            ...pontoColetor(12, 4.596, -60.168, "Amajari"),
            estab("POLO BASE MARARI", "800001", -3.35, -64.71, "Marari", "AM"),
            estab(
              "POLO BASE AUARIS",
              "800002",
              4.052133,
              -64.401244,
              "Amajari",
              "RR",
            ),
            estab(
              "UBSI SOZINHA",
              "800003",
              -2.123456,
              -60.987654,
              "Barcelos",
              "AM",
            ),
          ],
          c: [],
        },
      },
      nac: [],
    },
  };
  const linhas = classificar(montarRegistros(payload));
  const por = (nome) => linhas.find((l) => l.nome === nome);

  it("reconhece o ponto que junta muitos estabelecimentos distintos", () => {
    const um = por("UBSI ALDEIA 1");
    expect(um.lugaresNoPonto).toBe(12);
    expect(um.coletor).toBe(true);
    expect(um.problemas.join(" ")).toMatch(/ponto coletor/);
  });

  /*
    Esta é a regra que mais muda o retrato. A origem declarada é o CNES, o
    número é impecável, e ainda assim a coordenada não distingue doze
    estabelecimentos entre si — chamar-lhe oficial repetiria o erro que a
    auditoria veio expor.
  */
  it("rebaixa a confiança de quem está num ponto coletor, mesmo vindo do CNES", () => {
    expect(por("UBSI ALDEIA 1").nivel).toBe(NIVEIS.PENDENTE);
  });

  it("não rebaixa quem está sozinho no seu ponto", () => {
    const sozinha = por("UBSI SOZINHA");
    expect(sozinha.lugaresNoPonto).toBe(1);
    expect(sozinha.nivel).toBe(NIVEIS.OFICIAL_ESTABELECIMENTO);
  });

  it("assinala município como possível substituto da localização", () => {
    expect(por("UBSI ALDEIA 1").possivelSedeMunicipal).toBe(true);
    expect(por("UBSI SOZINHA").possivelSedeMunicipal).toBe(false);
  });

  it("mede o quanto o casamento moveu o polo e rebaixa se for longe", () => {
    const marari = por("Marari");
    expect(Math.round(marari.deslocamentoKm)).toBe(453);
    // Casou pelo nome, o que daria `oficial_cnes` — mas 453 km desmentem isso.
    expect(marari.nivel).toBe(NIVEIS.INFERIDA);
    expect(marari.problemas.join(" ")).toMatch(/moveu o polo/);
  });

  it("mantém oficial o polo cujo casamento confirma o que o lmap já dizia", () => {
    const auaris = por("Auaris");
    expect(auaris.deslocamentoKm).toBeLessThan(1);
    expect(auaris.nivel).toBe(NIVEIS.OFICIAL_CNES);
  });
});

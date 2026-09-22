import { describe, expect, it } from "vitest";
import {
  chaveDaUnidade,
  coordenadaValidada,
  indexarVereditos,
  rotuloDaLocalizacao,
  severidadeDaLocalizacao,
  veredictoDaUnidade,
} from "../src/lib/localizacoes-validadas.js";
import { LOCALIZACOES_VALIDADAS } from "../src/lib/localizacoes-validadas-gerado.js";

describe("chave da unidade", () => {
  /*
    As duas fontes escrevem o mesmo sítio de maneiras diferentes. Se a chave
    fosse o nome bruto, nenhum veredito encontraria a sua unidade.
  */
  it("junta as grafias do mesmo polo", () => {
    const esperada = chaveDaUnidade("ALTO RIO JURUA", "POLO BASE FEIJÓ");
    expect(chaveDaUnidade("ALTO RIO JURUA", "PB FEIJÓ")).toBe(esperada);
    expect(chaveDaUnidade("Alto Rio Juruá", "Feijó")).toBe(esperada);
  });

  it("não devolve chave quando o nome não sobrevive ao canónico", () => {
    expect(chaveDaUnidade("X", "PB")).toBe("");
    expect(chaveDaUnidade("X", "")).toBe("");
  });
});

describe("índice de vereditos", () => {
  it("encontra o veredito pelo DSEI e pelo nome", () => {
    const indice = indexarVereditos([
      {
        dsei: "POTIGUARA",
        canonico: "JOAO CAMARA",
        estado: "validada",
        lat: -5.5,
        lon: -35.8,
      },
    ]);
    const v = veredictoDaUnidade("Potiguara", "POLO BASE JOAO CAMARA", indice);
    expect(v?.estado).toBe("validada");
  });

  /*
    Duas linhas com a mesma chave não decidem nada — é exatamente a situação em
    que o script se recusa a arbitrar. O índice não pode escolher uma delas.
  */
  it("descarta a chave repetida em vez de escolher uma", () => {
    const indice = indexarVereditos([
      { dsei: "X", canonico: "AAA", estado: "validada", lat: 1, lon: 2 },
      { dsei: "X", canonico: "AAA", estado: "erro" },
    ]);
    expect(veredictoDaUnidade("X", "AAA", indice)).toBeNull();
  });

  it("ausência de veredito não é veredito", () => {
    const indice = indexarVereditos([]);
    expect(veredictoDaUnidade("X", "POLO BASE Y", indice)).toBeNull();
    expect(rotuloDaLocalizacao(null)).toBe("Localização em validação");
  });
});

/*
  Havia dois rótulos para cinco vereditos: `validada` e `erro` tinham o seu, e
  os outros 512 de 606 caíam em "Localização em validação" — a frase de quem
  ainda não olhou. Entre eles estavam 119 conflitos, com mediana de 101 km.
*/
describe("o que o mapa mostra", () => {
  it("só diz validada quando houve prova, e diz qual", () => {
    expect(
      rotuloDaLocalizacao({
        estado: "validada",
        motivo: "duas_fontes_concordam",
      }),
    ).toBe("Localização validada — duas fontes concordam");
    expect(
      rotuloDaLocalizacao({
        estado: "validada",
        motivo: "arbitrada_pela_uf_cnes",
      }),
    ).toContain("arbitrada pela UF");
  });

  /*
    O caso que faltava, e o mais importante: 119 unidades em que a planilha e o
    CNES discordam. Dizer "em validação" sobre isto é esconder o achado.
  */
  it("diz que as fontes discordam, e em quanto", () => {
    expect(
      rotuloDaLocalizacao({
        estado: "conflito",
        motivo: "duas_fontes_discordam_na_uf",
        km: 101.4,
      }),
    ).toBe("Fontes discordam em 101 km — localização não apurada");
  });

  it("abaixo de dez quilómetros a casa decimal ainda diz alguma coisa", () => {
    expect(rotuloDaLocalizacao({ estado: "conflito", km: 5.13 })).toContain(
      "5.1 km",
    );
  });

  it("conflito sem distância continua a ser conflito", () => {
    expect(rotuloDaLocalizacao({ estado: "conflito" })).toContain("discordam");
  });

  /*
    Uma fonte só a cair na UF certa não é confirmação: é ausência de
    contradição. O rótulo tem de dizer isso, senão vira carimbo.
  */
  it("não carimba de validada o que tem fonte única", () => {
    const rotulo = rotuloDaLocalizacao({
      estado: "coerente",
      motivo: "fonte_unica_na_uf",
    });
    expect(rotulo).toContain("Fonte única");
    expect(rotulo).not.toContain("validada");
  });

  /*
    A frase dizia "Sem UF ou sem coordenada" e afirmava a ausência errada:
    `uf_indeterminada` acontece quase sempre COM coordenada, e o mapa mostrava
    isso em cima de marcadores desenhados. Ver `tests/terra-indigena-verifica`.
  */
  it("diz o que faltou, e é a UF", () => {
    const rotulo = rotuloDaLocalizacao({ estado: "indeterminado" });
    expect(rotulo).toContain("UF não determinada");
    expect(rotulo).not.toContain("sem coordenada");
  });

  it("sem veredito nenhum, continua em validação", () => {
    expect(rotuloDaLocalizacao(null)).toBe("Localização em validação");
    expect(rotuloDaLocalizacao({ estado: "coisa nova" })).toBe(
      "Localização em validação",
    );
  });

  it("não esconde a coordenada que cai fora da UF declarada", () => {
    expect(rotuloDaLocalizacao({ estado: "erro" })).toContain(
      "fora da UF declarada",
    );
  });

  /*
    Quem desenha precisa de separar o que pede atenção do que está resolvido,
    sem repetir a tabela de estados em cada sítio que desenha.
  */
  it("separa por severidade, para quem desenha", () => {
    expect(severidadeDaLocalizacao({ estado: "validada" })).toBe("confirmada");
    expect(severidadeDaLocalizacao({ estado: "conflito" })).toBe("divergente");
    expect(severidadeDaLocalizacao({ estado: "erro" })).toBe("divergente");
    expect(severidadeDaLocalizacao({ estado: "coerente" })).toBe(
      "sem_contradicao",
    );
    expect(severidadeDaLocalizacao(null)).toBe("sem_veredito");
  });

  it("só substitui a coordenada quando o veredito é validada", () => {
    expect(
      coordenadaValidada({ estado: "validada", lat: -5.5, lon: -35.8 }),
    ).toEqual({
      lat: -5.5,
      lon: -35.8,
    });
    expect(
      coordenadaValidada({ estado: "erro", lat: -5.5, lon: -35.8 }),
    ).toBeNull();
    expect(
      coordenadaValidada({ estado: "coerente", lat: -5.5, lon: -35.8 }),
    ).toBeNull();
    expect(coordenadaValidada({ estado: "validada" })).toBeNull();
  });
});

/*
  O ficheiro gerado é dado, não código, mas é dado que decide o que o mapa
  desenha. Estes casos travam uma regeneração que saia deformada.
*/
describe("o ficheiro gerado", () => {
  /*
    Antes só viajavam `validada` e `erro` — 94 de 606 —, com o argumento de que
    os outros não mudavam nada. Mudavam: 119 deles são conflito, e o mapa
    escrevia "Localização em validação" por cima. Viajam todos.
  */
  it("traz os cinco vereditos, e não só os dois que trocam a coordenada", () => {
    const estados = new Set(LOCALIZACOES_VALIDADAS.map((r) => r.estado));
    expect([...estados].sort()).toEqual([
      "coerente",
      "conflito",
      "erro",
      "indeterminado",
      "validada",
    ]);
  });

  it("o conflito viaja com a distância entre as fontes", () => {
    const conflitos = LOCALIZACOES_VALIDADAS.filter(
      (r) => r.estado === "conflito",
    );
    expect(conflitos.length).toBeGreaterThan(100);
    for (const r of conflitos) {
      expect(Number.isFinite(r.km), `${r.canonico} sem distância`).toBe(true);
      expect(r.km, `${r.canonico}`).toBeGreaterThan(0);
    }
  });

  /*
    Coordenada só nos `validada`, que são os únicos em que o mapa a usa. Levá-la
    nos outros seria carregar um número que ninguém pode usar — e que alguém
    acabaria por usar.
  */
  it("só o veredito validada carrega coordenada", () => {
    for (const r of LOCALIZACOES_VALIDADAS) {
      if (r.estado === "validada") continue;
      expect(
        r.lat,
        `${r.canonico} não devia trazer coordenada`,
      ).toBeUndefined();
      expect(r.lon).toBeUndefined();
    }
  });

  it("todo veredito validada traz coordenada utilizável", () => {
    for (const r of LOCALIZACOES_VALIDADAS) {
      if (r.estado !== "validada") continue;
      expect(Number.isFinite(r.lat), `${r.canonico} sem latitude`).toBe(true);
      expect(Number.isFinite(r.lon), `${r.canonico} sem longitude`).toBe(true);
      expect(Math.abs(r.lat), `${r.canonico} fora do planeta`).toBeLessThan(90);
      expect(Math.abs(r.lon), `${r.canonico} fora do planeta`).toBeLessThan(
        180,
      );
    }
  });

  /*
    As coordenadas do Brasil continental cabem nesta caixa. Serve de rede
    contra o erro que a auditoria encontrou na planilha — uma linha com o ponto
    decimal perdido, a afirmar latitude -24182303.
  */
  it("nenhuma coordenada validada cai fora do Brasil", () => {
    for (const r of LOCALIZACOES_VALIDADAS) {
      if (r.estado !== "validada") continue;
      expect(r.lat, `${r.canonico}`).toBeGreaterThan(-34);
      expect(r.lat, `${r.canonico}`).toBeLessThan(6);
      expect(r.lon, `${r.canonico}`).toBeGreaterThan(-74);
      expect(r.lon, `${r.canonico}`).toBeLessThan(-34);
    }
  });

  it("cada veredito identifica o DSEI e a unidade", () => {
    for (const r of LOCALIZACOES_VALIDADAS) {
      expect(r.dsei, "veredito sem DSEI").toBeTruthy();
      expect(r.canonico, "veredito sem nome canónico").toBeTruthy();
      expect(r.motivo, "veredito sem motivo").toBeTruthy();
    }
  });
});

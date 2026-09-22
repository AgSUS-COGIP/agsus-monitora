import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decidirLocalizacao } from "../scripts/decidir-localizacao.mjs";
import { rotuloDaLocalizacao } from "../src/lib/localizacoes-validadas.js";
import { LOCALIZACOES_VALIDADAS } from "../src/lib/localizacoes-validadas-gerado.js";

/*
  A SEGUNDA PASSAGEM DA AUDITORIA DE LOCALIZAÇÃO

  A primeira correu sobre as 606 linhas da planilha de Lotações. Ficavam de
  fora 66 polos que existem só no banco e 829 estabelecimentos do CNES sem
  lotação correspondente — e o popup deles dizia "Localização em validação",
  que era verdade: ninguém os tinha olhado.

  Duas coisas mudaram o resultado, e as duas foram medidas antes de entrar.

  1. A PERGUNTA VAI AO MUNICÍPIO, NÃO SÓ À UF

     A primeira versão perguntava só à malha da UF, e nas 745 unidades de fonte
     única acusou UMA. A malha municipal acusou CINQUENTA E DUAS. Um crivo que
     quase nunca acusa nada não está a dizer nada.

  2. POLO DO BANCO + REGISTO DO CNES SÃO DUAS FONTES, NÃO AMBIGUIDADE

     `FULNI-Ô` no banco e `POLO BASE FULNI O` no CNES partilham a chave porque
     SÃO a mesma unidade — a reconciliação já os desenha como um ponto só. A
     primeira versão descartava a chave repetida, e era justamente o caso da
     pergunta que originou este trabalho.

  Resultado medido sobre os 1578 pontos do mapa: 1484 diziam "em validação",
  passam a ser 120.
*/
const malhaQuadrada = {
  sigla: "XX",
  caixa: { oeste: -40, leste: -30, sul: -20, norte: -10 },
  poligonos: [
    [
      [
        [-40, -20],
        [-30, -20],
        [-30, -10],
        [-40, -10],
        [-40, -20],
      ],
    ],
  ],
};

const municipios = new Map([
  [
    "1234567",
    {
      type: "Polygon",
      coordinates: [
        [
          [-36, -16],
          [-34, -16],
          [-34, -14],
          [-36, -14],
          [-36, -16],
        ],
      ],
    },
  ],
]);

const ponto = (lat, lon) => ({ lat, lon });

describe("uma fonte só", () => {
  it("dentro do município declarado é o que mais se pode dizer", () => {
    const d = decidirLocalizacao({
      primeira: ponto(-15, -35),
      uf: "XX",
      malha: malhaQuadrada,
      municipios,
      codigoMunicipio: "1234567",
    });
    expect(d.estado).toBe("coerente");
    expect(d.motivo).toBe("fonte_unica_no_municipio");
  });

  /*
    O crivo que a malha da UF deixava passar: dentro do estado, fora do
    município que o próprio cadastro declara. São 52 pontos reais.
  */
  it("fora do município declarado é contradição da própria base", () => {
    const d = decidirLocalizacao({
      primeira: ponto(-12, -38),
      uf: "XX",
      malha: malhaQuadrada,
      municipios,
      codigoMunicipio: "1234567",
    });
    expect(d.estado).toBe("erro");
    expect(d.motivo).toBe("fonte_unica_fora_do_municipio");
  });

  it("sem malha do município, a UF é o que resta — e diz-se qual foi", () => {
    const d = decidirLocalizacao({
      primeira: ponto(-15, -35),
      uf: "XX",
      malha: malhaQuadrada,
      municipios,
      codigoMunicipio: "9999999",
    });
    expect(d.motivo).toBe("fonte_unica_na_uf");
  });

  /*
    Ausência de malha não é "está fora". Acusar aí seria acusar o cadastro por
    falha nossa.
  */
  it("município desconhecido não vira acusação", () => {
    const d = decidirLocalizacao({
      primeira: ponto(-15, -35),
      uf: "XX",
      malha: malhaQuadrada,
      municipios: null,
      codigoMunicipio: null,
    });
    expect(d.estado).toBe("coerente");
  });

  it("fora da UF nem chega a perguntar ao município", () => {
    const d = decidirLocalizacao({
      primeira: ponto(0, 0),
      uf: "XX",
      malha: malhaQuadrada,
      municipios,
      codigoMunicipio: "1234567",
    });
    expect(d.motivo).toBe("fonte_unica_fora_da_uf");
  });

  /*
    Uma coordenada sozinha, por mais coerente que seja, não foi confirmada por
    ninguém. Este caso impede que alguém promova `coerente` a `validada`.
  */
  it("nunca sai validada", () => {
    for (const codigo of ["1234567", "9999999"]) {
      const d = decidirLocalizacao({
        primeira: ponto(-15, -35),
        uf: "XX",
        malha: malhaQuadrada,
        municipios,
        codigoMunicipio: codigo,
      });
      expect(d.estado).not.toBe("validada");
      expect(rotuloDaLocalizacao(d)).not.toContain("validada");
    }
  });

  it("sem UF não há o que verificar", () => {
    expect(
      decidirLocalizacao({ primeira: ponto(-15, -35), uf: null, malha: null })
        .motivo,
    ).toBe("uf_indeterminada");
    expect(
      decidirLocalizacao({ primeira: null, uf: "XX", malha: malhaQuadrada })
        .motivo,
    ).toBe("uf_indeterminada");
  });
});

describe("duas fontes para a mesma unidade", () => {
  const dentroDaUf = { uf: "XX", malha: malhaQuadrada };

  it("perto uma da outra, a localização fica confirmada", () => {
    const d = decidirLocalizacao({
      primeira: ponto(-15, -35),
      segunda: ponto(-15.01, -35.01),
      ...dentroDaUf,
    });
    expect(d.estado).toBe("validada");
    expect(d.motivo).toBe("duas_fontes_concordam");
  });

  it("longe uma da outra, é conflito — e a distância vai junto", () => {
    const d = decidirLocalizacao({
      primeira: ponto(-15, -35),
      segunda: ponto(-18, -38),
      ...dentroDaUf,
    });
    expect(d.estado).toBe("conflito");
    expect(d.prova.km).toBeGreaterThan(5);
  });

  /*
    Duas fontes no mesmo ponto não são duas fontes: é a mesma origem vista duas
    vezes, e não confirma nada.
  */
  it("a mesma coordenada nas duas bases não confirma nada", () => {
    const d = decidirLocalizacao({
      primeira: ponto(-15, -35),
      segunda: ponto(-15, -35),
      ...dentroDaUf,
    });
    expect(d.estado).toBe("coerente");
    expect(d.motivo).toBe("copia_entre_fontes_na_uf");
  });

  /*
    A ordem das duas posições nomeia o veredito: a primeira é a do banco, a
    segunda a do CNES. Trocá-las trocaria `arbitrada_pela_uf_cnes` por
    `arbitrada_pela_uf_lotacoes`, e o registo da auditoria passaria a dizer que
    ganhou quem perdeu.
  */
  it("quando uma cai fora da UF, a outra arbitra — e sabe-se qual", () => {
    expect(
      decidirLocalizacao({
        primeira: ponto(0, 0),
        segunda: ponto(-15, -35),
        ...dentroDaUf,
      }).motivo,
    ).toBe("arbitrada_pela_uf_cnes");

    expect(
      decidirLocalizacao({
        primeira: ponto(-15, -35),
        segunda: ponto(0, 0),
        ...dentroDaUf,
      }).motivo,
    ).toBe("arbitrada_pela_uf_lotacoes");
  });

  it("ambas fora da UF é erro, não arbitragem", () => {
    expect(
      decidirLocalizacao({
        primeira: ponto(0, 0),
        segunda: ponto(10, 10),
        ...dentroDaUf,
      }).motivo,
    ).toBe("ambas_fora_da_uf");
  });
});

/*
  A regra vive num sítio só. Enquanto estiver escrita nas duas passagens, elas
  divergem, e dois vereditos com o mesmo nome passam a querer dizer coisas
  diferentes.
*/
describe("as duas passagens decidem pelo mesmo código", () => {
  const primeira = readFileSync("scripts/validar-localizacoes.mjs", "utf8");
  const segunda = readFileSync(
    "scripts/validar-localizacoes-sem-par.mjs",
    "utf8",
  );

  it("as duas importam decidirLocalizacao", () => {
    expect(primeira).toContain('from "./decidir-localizacao.mjs"');
    expect(segunda).toContain('from "./decidir-localizacao.mjs"');
  });

  it("nenhuma guarda a sua própria cópia da regra", () => {
    expect(primeira).not.toContain("function decidir({");
    expect(segunda).not.toContain("function decidirFonteUnica(");
  });
});

describe("o ficheiro depois das duas passagens", () => {
  it("cobre bem mais do que as 606 lotações da planilha", () => {
    expect(LOCALIZACOES_VALIDADAS.length).toBeGreaterThan(1300);
  });

  it("os vereditos da segunda passagem também trazem motivo", () => {
    for (const r of LOCALIZACOES_VALIDADAS) {
      expect(r.motivo, `${r.canonico} sem motivo`).toBeTruthy();
      expect(r.estado, `${r.canonico} sem estado`).toBeTruthy();
    }
  });

  /*
    Um motivo que o rótulo não conheça cai no texto genérico, e o ecrã volta a
    dizer "em validação" sobre coisa que foi auditada. Este caso apanha isso no
    dia em que a auditoria inventar um motivo novo.
  */
  it("todo motivo no ficheiro tem uma frase própria no ecrã", () => {
    const semFrase = new Set();
    for (const r of LOCALIZACOES_VALIDADAS) {
      if (rotuloDaLocalizacao(r) === "Localização em validação") {
        semFrase.add(`${r.estado}/${r.motivo}`);
      }
    }
    expect([...semFrase]).toEqual([]);
  });
});

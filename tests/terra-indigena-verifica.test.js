import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  forcaDoVeredito,
  veredictoQuePrevalece,
} from "../src/lib/forca-do-veredito.js";
import { rotuloDaLocalizacao } from "../src/lib/localizacoes-validadas.js";
import { LOCALIZACOES_VALIDADAS } from "../src/lib/localizacoes-validadas-gerado.js";

/*
  TRÊS DEFEITOS QUE UM POPUP MOSTROU

  `POLO BASE I KARAPOTO TERRA NOVA`, no DSEI Alagoas e Sergipe, dizia "Sem UF ou
  sem coordenada — não foi possível verificar" num marcador desenhado a 2,9 km
  da TI Karapotó. Três coisas estavam erradas ao mesmo tempo:

  1. A FRASE MENTIA. `uf_indeterminada` é o veredito de quando não se decide a
     UF, e isso acontece quase sempre COM coordenada. Dizer "sem coordenada"
     sobre um ponto desenhado no mapa faz quem lê concluir, com razão, que o
     painel não sabe o que está a dizer.

  2. A FUSÃO ESCOLHIA A PIOR RESPOSTA. Aquele marcador é a reconciliação de
     dois registos — o polo da planilha, com `indeterminado`, e o registo do
     CNES, com `coerente`. A regra era "vale o do polo", e o popup dizia "não
     foi possível conferir" sobre um ponto conferido.

  3. A PROVA MAIS ÓBVIA NUNCA FOI USADA. A auditoria cruzou a planilha, o CNES
     e as malhas do IBGE, e nunca cruzou com o que este mapa desenha por cima de
     tudo: as 665 Terras Indígenas da Funai.
*/
describe("qual de dois vereditos prevalece", () => {
  const polo = { estado: "indeterminado", motivo: "uf_indeterminada" };
  const cnes = { estado: "coerente", motivo: "fonte_unica_no_municipio" };

  it("o que não diz nada perde para o que diz", () => {
    expect(veredictoQuePrevalece(polo, cnes)).toBe(cnes);
    expect(veredictoQuePrevalece(cnes, polo)).toBe(cnes);
  });

  /*
    A ordem NÃO é "mostrar a melhor notícia". Um conflito entre fontes tem de
    aparecer mesmo que o outro lado diga que está tudo bem — esconder problema
    atrás de boa notícia seria pior do que o defeito original.
  */
  it("um problema nunca se esconde atrás de uma confirmação", () => {
    const conflito = { estado: "conflito", km: 12 };
    const validada = { estado: "validada", motivo: "duas_fontes_concordam" };
    expect(veredictoQuePrevalece(validada, conflito)).toBe(conflito);
    expect(veredictoQuePrevalece(conflito, validada)).toBe(conflito);
  });

  it("a ordem é problema, confirmado, sem contradição, não olhado", () => {
    expect(forcaDoVeredito({ estado: "erro" })).toBe(3);
    expect(forcaDoVeredito({ estado: "conflito" })).toBe(3);
    expect(forcaDoVeredito({ estado: "validada" })).toBe(2);
    expect(forcaDoVeredito({ estado: "coerente" })).toBe(1);
    expect(forcaDoVeredito({ estado: "indeterminado" })).toBe(0);
    expect(forcaDoVeredito(null)).toBe(0);
  });

  it("empate fica com o primeiro, que é o do polo", () => {
    const a = { estado: "coerente", motivo: "fonte_unica_no_municipio" };
    const b = { estado: "coerente", motivo: "fonte_unica_na_uf" };
    expect(veredictoQuePrevalece(a, b)).toBe(a);
  });

  it("um lado ausente não apaga o outro", () => {
    expect(veredictoQuePrevalece(null, cnes)).toBe(cnes);
    expect(veredictoQuePrevalece(polo, null)).toBe(polo);
    expect(veredictoQuePrevalece(null, null)).toBeNull();
  });
});

describe("a frase que mentia", () => {
  it("não diz mais que falta coordenada quando falta é a UF", () => {
    const rotulo = rotuloDaLocalizacao({
      estado: "indeterminado",
      motivo: "uf_indeterminada",
    });
    expect(rotulo).toContain("UF não determinada");
    expect(rotulo).not.toContain("coordenada —");
    expect(rotulo).not.toContain("sem coordenada");
  });
});

/*
  A terceira fonte. Medido sobre os 1577 pontos do mapa: 789 caem dentro de uma
  Terra Indígena, e 530 deles não tinham confirmação independente nenhuma.

  Nenhuma CASAI cai dentro de terra, e está certo — casa de apoio fica na
  cidade, perto do hospital de referência. É o contrário que seria suspeito.
*/
describe("a Terra Indígena como prova", () => {
  it("nomeia a terra, que é o que se apurou", () => {
    expect(
      rotuloDaLocalizacao({
        estado: "coerente",
        motivo: "dentro_de_terra_indigena",
        terra: "Fulni-ô",
      }),
    ).toBe("Dentro da Terra Indígena Fulni-ô (Funai)");
  });

  it("sem o nome, ainda diz o que sabe", () => {
    expect(
      rotuloDaLocalizacao({
        estado: "coerente",
        motivo: "dentro_de_terra_indigena",
      }),
    ).toBe("Dentro de Terra Indígena (Funai)");
  });

  /*
    Estar dentro da terra confirma que o ponto está num lugar coerente com o que
    a unidade faz. Não confirma o ponto exato — e promover isto a `validada`
    afirmaria mais do que se apurou.
  */
  it("não é confirmação de posição, e o estado diz isso", () => {
    const dentro = { estado: "coerente", motivo: "dentro_de_terra_indigena" };
    expect(forcaDoVeredito(dentro)).toBe(1);
    expect(rotuloDaLocalizacao(dentro)).not.toContain("validada");
  });
});

describe("o ficheiro depois da terceira passagem", () => {
  const daTerra = LOCALIZACOES_VALIDADAS.filter(
    (r) => r.motivo === "dentro_de_terra_indigena",
  );

  it("promoveu centenas de pontos", () => {
    expect(daTerra.length).toBeGreaterThan(400);
  });

  it("cada um sabe em que terra está", () => {
    for (const r of daTerra) expect(r.terra, r.canonico).toBeTruthy();
  });

  it("nenhum deles virou validada", () => {
    for (const r of daTerra) expect(r.estado).toBe("coerente");
  });

  /*
    A terra não arbitra entre duas coordenadas discordantes nem corrige um
    município mal escrito. `erro` e `conflito` ficam onde estavam.
  */
  it("não apagou nenhum problema encontrado antes", () => {
    const problemas = LOCALIZACOES_VALIDADAS.filter(
      (r) => r.estado === "erro" || r.estado === "conflito",
    );
    expect(problemas.length).toBeGreaterThan(150);
    for (const r of problemas) {
      expect(r.motivo).not.toBe("dentro_de_terra_indigena");
    }
  });

  /*
    Nenhuma CASAI deve ter sido promovida pela terra: elas ficam na cidade. Se
    alguma aparecer aqui, ou a CASAI está no sítio errado ou a chave colidiu.
  */
  it("nenhuma CASAI foi confirmada por estar dentro de terra", () => {
    for (const r of daTerra) expect(r.casai, r.canonico).not.toBe(true);
  });
});

describe("a reconciliação usa a regra", () => {
  const lib = readFileSync("src/lib/reconciliacao-unidades.js", "utf8");

  it("deixou de assumir o veredito do polo", () => {
    expect(lib).toContain("veredictoQuePrevalece(");
    expect(lib).not.toContain("veredicto: polo.veredicto_localizacao || null");
  });
});

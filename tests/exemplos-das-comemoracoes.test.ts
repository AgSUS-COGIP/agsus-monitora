import { describe, expect, it } from "vitest";
import { CATALOGO_DE_MARCOS } from "../src/lib/catalogo-de-comemoracoes.ts";
import { letreiroDoMarcoDoAno } from "../src/lib/comemoracao.ts";
import { exemploDoMarco } from "../src/lib/exemplos-das-comemoracoes.ts";

/*
  O "Testar" de Configurações › Comemorações mostrava no aviso o rótulo da
  configuração ("Marco do ano da área (1.000, 2.500… análises)"); agora
  mostra a frase que a pessoa vai ler, montada pela mesma função do marco.
*/
describe("exemplos das comemorações", () => {
  it("todo marco do catálogo tem uma frase de exemplo, diferente do rótulo", () => {
    for (const marco of CATALOGO_DE_MARCOS) {
      const { texto } = exemploDoMarco(marco.id, marco.rotulo);
      expect(texto, marco.id).not.toBe(marco.rotulo);
      expect(texto, marco.id).not.toMatch(/undefined|null|NaN|🎉/);
    }
  });

  it("as frases saem das funções de verdade", () => {
    expect(exemploDoMarco("fila-zerada", "").texto).toBe(
      "Fila zerada, nenhuma análise pendente. Obrigado, equipe da Saúde Indígena!",
    );
    expect(exemploDoMarco("acesso-liberado", "").texto).toBe(
      "Boas-vindas, Ana! Seu acesso ao MONITORA foi liberado.",
    );
    expect(exemploDoMarco("marco-do-ano", "").letreiro).toBe("1.000 análises");
  });

  it("marco sem exemplo cai no rótulo", () => {
    expect(exemploDoMarco("nao-existe", "Rótulo")).toEqual({ texto: "Rótulo" });
  });
});

describe("letreiro do marco do ano", () => {
  it("o número com a palavra enquanto cabe nos 14 caracteres", () => {
    expect(letreiroDoMarcoDoAno(1000)).toBe("1.000 análises");
    expect(letreiroDoMarcoDoAno(7500)).toBe("7.500 análises");
    expect(letreiroDoMarcoDoAno(10000)).toBe("10.000!");
    expect(letreiroDoMarcoDoAno(15000)).toBe("15.000!");
  });
});

import { describe, expect, it } from "vitest";
import { CATALOGO_DE_MARCOS } from "../src/lib/comemoracao/catalogo-de-comemoracoes.ts";
import { exemploDoMarco } from "../src/lib/comemoracao/exemplos-das-comemoracoes.ts";

/*
  O "Testar" de Configurações › Comemorações mostrava no aviso o rótulo da
  configuração ("Marco do ano da área (1.000, 2.500… análises)"); agora
  mostra a frase que a pessoa vai ler, montada pela mesma função do marco.
  As frases dizem o fato com o número: sem exclamação empilhada e sem
  "Obrigado, equipe".
*/
describe("exemplos das comemorações", () => {
  it("todo marco do catálogo tem uma frase de exemplo, diferente do rótulo", () => {
    for (const marco of CATALOGO_DE_MARCOS) {
      const texto = exemploDoMarco(marco.id, marco.rotulo);
      expect(texto, marco.id).not.toBe(marco.rotulo);
      expect(texto, marco.id).not.toMatch(/undefined|null|NaN|🎉|Obrigado/);
    }
  });

  it("as frases saem das funções de verdade", () => {
    expect(exemploDoMarco("edital-concluido", "")).toBe(
      "Edital 114/2026 (Rio de Janeiro): as 1.512 fichas foram analisadas.",
    );
    expect(exemploDoMarco("edital-fechado", "")).toBe(
      "Você concluiu a última ficha do edital 114/2026.",
    );
    expect(exemploDoMarco("fila-zerada", "")).toBe(
      "Nenhuma ficha pendente na SEDE.",
    );
    expect(exemploDoMarco("vaga-pronta", "")).toBe(
      "Vaga 179698 (Químico): todas as entrevistas têm parecer. Já pode seguir para a Classificação.",
    );
    expect(exemploDoMarco("marco-do-ano", "")).toMatch(
      /^Saúde Indígena: 7\.500 análises concluídas em \d{4}\.$/,
    );
    expect(exemploDoMarco("acesso-liberado", "")).toBe(
      "Boas-vindas, Ana! Seu acesso ao Yeendé foi liberado.",
    );
  });

  it("marco sem exemplo cai no rótulo", () => {
    expect(exemploDoMarco("nao-existe", "Rótulo")).toBe("Rótulo");
  });
});

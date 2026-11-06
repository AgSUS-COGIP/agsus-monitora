import { describe, expect, it } from "vitest";
import {
  ATRASO_MAXIMO,
  ATRASO_POR_LETRA,
  contrasteDoLetreiro,
  CORES_DO_LETREIRO,
  corComposta,
  duracaoDoEfeito,
  ENTRADA_DO_LETREIRO,
  faseDoLetreiro,
  FONTE_MAXIMA_PX,
  larguraDoLetreiro,
  layoutDoLetreiro,
  LEITURA_MINIMA,
  mostrarLetreiro,
  SAIDA_DO_LETREIRO,
  tempoDoLetreiro,
  textoDoLetreiro,
} from "../src/modulos/comemoracao/letreiro.ts";

/*
  O letreiro (a frase do marco, ex.: "Parabéns!") é texto de verdade numa
  placa escura: cabe em qualquer tela, tem contraste AA nos dois temas, entra
  letra a letra e fica parado o tempo de ler.
*/

describe("letreiro legível", () => {
  it("o texto é limpo e curto; sem texto, nada", () => {
    expect(textoDoLetreiro("  Meta   batida!  ")).toBe("Meta batida!");
    expect(textoDoLetreiro("Uma frase comprida demais")).toHaveLength(14);
    expect(textoDoLetreiro("   ")).toBeNull();
    expect(textoDoLetreiro(null)).toBeNull();
    expect(layoutDoLetreiro("")).toBeNull();
  });

  it("aparece no Normal e no Festa, não no Suave nem sem frase", () => {
    expect(mostrarLetreiro({ letreiro: "Valeu!", intensidade: "normal" })).toBe(
      true,
    );
    expect(mostrarLetreiro({ letreiro: "Valeu!", intensidade: "festa" })).toBe(
      true,
    );
    expect(mostrarLetreiro({ letreiro: "Valeu!", intensidade: "suave" })).toBe(
      false,
    );
    expect(
      mostrarLetreiro({ letreiro: "Valeu!", intensidade: "pequeno" }),
    ).toBe(false);
    expect(mostrarLetreiro({ letreiro: null, intensidade: "festa" })).toBe(
      false,
    );
    expect(mostrarLetreiro(null)).toBe(false);
  });

  it("as letras entram uma depois da outra, sem passar do atraso máximo", () => {
    const curto = layoutDoLetreiro("Valeu!");
    expect(curto.letras.map((l) => l.letra).join("")).toBe("Valeu!");
    expect(curto.letras[1].atraso).toBeCloseTo(ATRASO_POR_LETRA);
    const atrasos = curto.letras.map((l) => l.atraso);
    expect([...atrasos].sort((a, b) => a - b)).toEqual(atrasos);
    const longo = layoutDoLetreiro("Boas-vindas!!!");
    expect(longo.letras.at(-1).atraso).toBeLessThanOrEqual(ATRASO_MAXIMO);
    // O espaço vira um espaço que não some (inline-block).
    const comEspaco = layoutDoLetreiro("Meta batida!");
    expect(comEspaco.letras.filter((l) => l.espaco)).toHaveLength(1);
    // Letra acentuada conta como uma só.
    expect(layoutDoLetreiro("Parabéns!").letras).toHaveLength(9);
  });

  it("a fonte é um clamp: a frase curta é maior e nenhuma passa da tela", () => {
    const curto = layoutDoLetreiro("100%!");
    const longo = layoutDoLetreiro("Boas-vindas!!!");
    expect(curto.fonte).toMatch(/^clamp\(\d+px, [\d.]+vw, \d+px\)$/);
    expect(curto.vw).toBeGreaterThan(longo.vw);
    for (const largura of [320, 375, 768, 1280, 1920, 2560])
      for (const layout of [curto, longo, layoutDoLetreiro("Parabéns!")])
        expect(larguraDoLetreiro(layout, largura)).toBeLessThanOrEqual(
          largura - 32,
        );
    // Grande de verdade numa tela comum.
    expect(
      larguraDoLetreiro(layoutDoLetreiro("Parabéns!"), 1280) / 9 / 0.62,
    ).toBeGreaterThanOrEqual(64);
    expect(FONTE_MAXIMA_PX).toBeGreaterThanOrEqual(96);
  });

  it("contraste AA (>= 4.5:1) do texto e do destaque sobre a placa, em tema claro e escuro", () => {
    expect(
      contrasteDoLetreiro(["#ffffff", "#f4f6fa", "#000000", "#0b1220"]),
    ).toBeGreaterThanOrEqual(4.5);
    // Com confete claro por trás (amarelo, ciano), também.
    expect(contrasteDoLetreiro(["#ffd23f", "#59f2c8"])).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(corComposta("#000000", 0.5, "#ffffff")).toBe("#808080");
    // A placa é escura e quase opaca: a conta não depende do fundo.
    expect(CORES_DO_LETREIRO.alfaDaPlaca).toBeGreaterThanOrEqual(0.75);
  });

  it("entra no clímax e sai antes do fim do efeito, sempre com o tempo de ler", () => {
    const fogos = tempoDoLetreiro({ duracao: 5.5, efeito: "fogos" });
    expect(fogos.inicio).toBeGreaterThan(0.3);
    expect(fogos.fim).toBeLessThanOrEqual(5.5);
    expect(
      fogos.saida - fogos.inicio - ENTRADA_DO_LETREIRO,
    ).toBeGreaterThanOrEqual(LEITURA_MINIMA - 1e-9);
    expect(fogos.fim - fogos.saida).toBeCloseTo(SAIDA_DO_LETREIRO);
    // Fogos: mais tarde (perto do grande final) que o confete.
    const longoFogos = tempoDoLetreiro({ duracao: 12, efeito: "fogos" });
    const longoConfete = tempoDoLetreiro({ duracao: 12, efeito: "confete" });
    expect(longoFogos.inicio).toBeGreaterThan(longoConfete.inicio);
    expect(longoFogos.fim).toBeLessThanOrEqual(12);
    // Efeito curto: a frase passa do efeito, mas dá para ler.
    const curto = tempoDoLetreiro({ duracao: 2, efeito: "confete" });
    expect(curto.inicio).toBeCloseTo(0.3);
    expect(
      curto.saida - curto.inicio - ENTRADA_DO_LETREIRO,
    ).toBeGreaterThanOrEqual(LEITURA_MINIMA - 1e-9);
    // Com menos movimento, logo de cara.
    expect(
      tempoDoLetreiro({ duracao: 5, efeito: "fogos", reduzido: true }).inicio,
    ).toBeLessThan(0.5);
  });

  it("as fases seguem o tempo: antes, entrando, saindo e fim", () => {
    const tempo = { inicio: 1, saida: 4, fim: 4.6 };
    expect(faseDoLetreiro(0.5, tempo)).toBe("antes");
    expect(faseDoLetreiro(1, tempo)).toBe("entrando");
    expect(faseDoLetreiro(3.9, tempo)).toBe("entrando");
    expect(faseDoLetreiro(4.2, tempo)).toBe("saindo");
    expect(faseDoLetreiro(5, tempo)).toBe("fim");
  });

  it("a duração do efeito vem do plano: a pedida (fogos nunca abaixo de 4 s) ou a padrão", () => {
    expect(duracaoDoEfeito({ efeito: "confete", duracaoMs: 8000 })).toBe(8);
    expect(duracaoDoEfeito({ efeito: "fogos", duracaoMs: 2000 })).toBe(4);
    expect(duracaoDoEfeito({ efeito: "fogos", duracaoMs: null })).toBe(5.5);
    expect(duracaoDoEfeito({ efeito: "baloes", duracaoMs: null })).toBe(5);
  });
});

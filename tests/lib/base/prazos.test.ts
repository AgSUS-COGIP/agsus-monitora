import { describe, expect, it } from "vitest";
import {
  contarPorFaixa,
  diasAte,
  faixaDosDias,
  situacaoDoPrazo,
  textoDosDiasRestantes,
} from "../../../src/lib/base/prazos.ts";

describe("faixas de prazo", () => {
  it("conta dias de calendário, inclusive na virada de mês e de ano", () => {
    expect(diasAte("2026-11-18", "2026-11-18")).toBe(0);
    expect(diasAte("2026-12-01", "2026-11-30")).toBe(1);
    expect(diasAte("2027-01-01", "2026-12-31")).toBe(1);
    expect(diasAte("2026-11-15", "2026-11-18")).toBe(-3);
    expect(diasAte("2026-11-18T23:59:00-03:00", "2026-11-18")).toBe(0);
    expect(diasAte(null, "2026-11-18")).toBeNull();
    expect(diasAte("", "2026-11-18")).toBeNull();
    expect(diasAte("18/11/2026", "2026-11-18")).toBeNull();
  });

  it("vencido só depois do dia; os limites de 30, 90 e 180", () => {
    expect(faixaDosDias(-1)).toBe("vencido");
    expect(faixaDosDias(0)).toBe("ate-30");
    expect(faixaDosDias(29)).toBe("ate-30");
    expect(faixaDosDias(30)).toBe("ate-90");
    expect(faixaDosDias(89)).toBe("ate-90");
    expect(faixaDosDias(90)).toBe("ate-180");
    expect(faixaDosDias(179)).toBe("ate-180");
    expect(faixaDosDias(180)).toBe("depois");
    expect(situacaoDoPrazo("2026-12-18", "2026-11-18")).toEqual({
      dias: 30,
      faixa: "ate-90",
    });
    expect(situacaoDoPrazo(undefined, "2026-11-18")).toBeNull();
  });

  it("o texto da coluna dias restantes diz a situação sem depender da cor", () => {
    expect(textoDosDiasRestantes(0)).toBe("Vence hoje");
    expect(textoDosDiasRestantes(1)).toBe("Vence amanhã");
    expect(textoDosDiasRestantes(12)).toBe("Vence em 12 dias");
    expect(textoDosDiasRestantes(1200)).toBe("Vence em 1.200 dias");
    expect(textoDosDiasRestantes(-1)).toBe("Venceu ontem");
    expect(textoDosDiasRestantes(-3)).toBe("Venceu há 3 dias");
  });

  it("conta por faixa, sem as datas vazias", () => {
    expect(
      contarPorFaixa(
        ["2026-11-01", "2026-11-18", "2027-01-10", "2027-12-31", null],
        "2026-11-18",
      ),
    ).toEqual({
      vencido: 1,
      "ate-30": 1,
      "ate-90": 1,
      "ate-180": 0,
      depois: 1,
    });
  });
});

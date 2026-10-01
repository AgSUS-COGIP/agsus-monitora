// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  chaveDoDia,
  editaisComEtapaNaSemana,
  primeiroNome,
  resumoDoDia,
  saudacao,
} from "../src/lib/boas-vindas.js";

describe("textos das boas-vindas", () => {
  it("saúda pela hora", () => {
    expect(saudacao(8)).toBe("Bom dia");
    expect(saudacao(12)).toBe("Boa tarde");
    expect(saudacao(19)).toBe("Boa noite");
  });

  it("usa o primeiro nome, sem caixa alta", () => {
    expect(primeiroNome("YASSURY SOUSA")).toBe("Yassury");
    expect(primeiroNome("  maria de fátima ")).toBe("Maria");
    expect(primeiroNome("ÂNGELA")).toBe("Ângela");
    expect(primeiroNome("")).toBe("");
  });

  it("conta editais com etapa de hoje até daqui a 7 dias", () => {
    const hoje = new Date(2026, 8, 28);
    const linhas = [
      { cronograma_proxima_data: "2026-09-28" },
      { cronograma_proxima_data: "2026-10-05" },
      { cronograma_proxima_data: "2026-10-06" },
      { cronograma_proxima_data: "2026-09-27" },
      { cronograma_proxima_data: null },
    ];
    expect(editaisComEtapaNaSemana(linhas, hoje)).toBe(2);
    expect(chaveDoDia(hoje)).toBe("2026-09-28");
  });

  it("resume o dia com informação real", () => {
    expect(resumoDoDia(0)).toBe("Nenhum edital com etapa nos próximos 7 dias.");
    expect(resumoDoDia(1)).toBe("1 edital tem etapa nos próximos 7 dias.");
    expect(resumoDoDia(1234)).toBe(
      "1.234 editais têm etapa nos próximos 7 dias.",
    );
  });
});

// O card na Visão geral (React): tests/modulos/visao-geral.test.js.

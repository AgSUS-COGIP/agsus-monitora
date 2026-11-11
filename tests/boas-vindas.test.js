// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  chaveDoDia,
  editaisComEtapaNaSemana,
  primeiroNome,
  resumoDoDia,
  saudacao,
} from "../src/lib/boas-vindas.ts";

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
    // 12h de Brasília: o mesmo dia em qualquer fuso do computador.
    const hoje = new Date("2026-09-28T15:00:00Z");
    const linhas = [
      { cronograma_proxima_data: "2026-09-28" },
      { cronograma_proxima_data: "2026-10-05" },
      { cronograma_proxima_data: "2026-10-06" },
      { cronograma_proxima_data: "2026-09-27" },
      { cronograma_proxima_data: null },
    ];
    expect(editaisComEtapaNaSemana(linhas, hoje)).toBe(2);
  });

  it("usa o dia de Brasília e não conta edital cancelado (auditoria de 10/11/2026)", () => {
    // 23h30 de 27/09 em Brasília = 02h30 de 28/09 em UTC: o dia é 27/09.
    const noiteEmBrasilia = new Date("2026-09-28T02:30:00Z");
    const linhas = [
      { cronograma_proxima_data: "2026-09-27" },
      { cronograma_proxima_data: "2026-10-04" },
      { cronograma_proxima_data: "2026-10-05" },
      { cronograma_proxima_data: "2026-09-30", status: "Cancelado" },
    ];
    expect(editaisComEtapaNaSemana(linhas, noiteEmBrasilia)).toBe(2);
  });

  it("chaveDoDia segue o dia local do Date", () => {
    expect(chaveDoDia(new Date(2026, 8, 28))).toBe("2026-09-28");
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

import { describe, expect, it } from "vitest";
import {
  descreverAgenda,
  lerAgenda,
  maiorIntervaloMin,
  proximaExecucao,
} from "../src/lib/agenda-do-cron.ts";

/* "Agora" fixo: 22/10/2026 14:37 UTC (uma quinta-feira). */
const AGORA = new Date("2026-10-22T14:37:00Z");

describe("lerAgenda", () => {
  it("cinco campos válidos; o resto não tem regra", () => {
    expect(lerAgenda("*/5 * * * *")?.minutos).toHaveLength(12);
    expect(lerAgenda("0 9 * * 7")?.semana.has(0)).toBe(true);
    expect(lerAgenda("30 seconds")).toBeNull();
    expect(lerAgenda("61 * * * *")).toBeNull();
    expect(lerAgenda(null)).toBeNull();
  });
});

describe("maiorIntervaloMin (o ciclo inteiro da agenda)", () => {
  const intervalo = (agenda: string) => maiorIntervaloMin(agenda, AGORA);

  it("frequentes e de hora em hora", () => {
    expect(intervalo("*/5 * * * *")).toBe(5);
    expect(intervalo("1-59/2 * * * *")).toBe(2);
    expect(intervalo("25 * * * *")).toBe(60);
    expect(intervalo("20,50 * * * *")).toBe(30);
  });

  it("a noite sem carga e as faixas do dia contam", () => {
    // Seleção: 11h10, 16h10 e 21h10 UTC → a noite de 14 h.
    expect(intervalo("10 11,16,21 * * *")).toBe(14 * 60);
    // Entrevistas: 0–10, 15 e 21–23 UTC → de 10h05 a 15h05 e de 15h05 a 21h05.
    expect(intervalo("5 0-10,15,21-23 * * *")).toBe(6 * 60);
    expect(intervalo("*/5 8-18 * * *")).toBe(13 * 60 + 5);
  });

  it("diária, semanal (fim de semana) e mensal", () => {
    expect(intervalo("0 9 * * *")).toBe(24 * 60);
    expect(intervalo("0 9 * * 1-5")).toBe(3 * 24 * 60);
    expect(intervalo("0 6 1 * *")).toBe(31 * 24 * 60);
  });

  it("sem regra: nulo", () => {
    expect(intervalo("qualquer")).toBeNull();
  });
});

describe("descreverAgenda (horário de Brasília)", () => {
  it("passos regulares a toda hora", () => {
    expect(descreverAgenda("*/5 * * * *")).toBe("a cada 5 min");
    expect(descreverAgenda("20,50 * * * *")).toBe("a cada 30 min");
    expect(descreverAgenda("25 * * * *")).toBe("de hora em hora");
  });

  it("horários do dia", () => {
    expect(descreverAgenda("0 9 * * *")).toBe("todo dia às 6h");
    expect(descreverAgenda("10 11,16,21 * * *")).toBe("às 8h10, 13h10 e 18h10");
    // 2h UTC = 23h de Brasília do dia anterior.
    expect(descreverAgenda("30 2 * * *")).toBe("todo dia às 23h30");
  });

  it("muitas horas num minuto só: a faixa vira a meia-noite", () => {
    expect(descreverAgenda("5 0-10,15,21-23 * * *")).toBe(
      "de hora em hora das 18h05 às 7h05 e às 12h05",
    );
  });

  it("o que não cabe volta como está", () => {
    expect(descreverAgenda("0 6 1 * *")).toBe("0 6 1 * *");
    expect(descreverAgenda("0 9 * * 1-5")).toBe("0 9 * * 1-5");
    expect(descreverAgenda("7,9 * * * *")).toBe("7,9 * * * *");
    expect(descreverAgenda("qualquer")).toBe("qualquer");
  });
});

describe("proximaExecucao", () => {
  it("aceita a agenda já lida", () => {
    const lida = lerAgenda("0 9 * * *");
    expect(proximaExecucao(lida, AGORA)?.toISOString()).toBe(
      "2026-10-23T09:00:00.000Z",
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cargoCurto,
  gravarPorVagaAberto,
  lerPorVagaAberto,
  ordenarPorVaga,
  resumoPorVaga,
} from "../../src/lib/avaliacao-documental/andamento-por-vaga.ts";

const vaga = (codigo, lote, concluidas, pendentes = lote - concluidas) => ({
  codigo,
  cargo: "",
  lote,
  concluidas,
  em_analise: lote - concluidas - pendentes,
  revisao: 0,
  pendentes,
});

describe("cargoCurto", () => {
  it("tira o 'CARGO n:' da frente e o '(Nível …)' do fim", () => {
    expect(
      cargoCurto("CARGO 1: QUÍMICO - Análise da Água (Nível Superior)"),
    ).toBe("QUÍMICO - Análise da Água");
    expect(
      cargoCurto("CARGO 10: SUPERVISOR DE SAÚDE AMBIENTAL (Nivel Médio)"),
    ).toBe("SUPERVISOR DE SAÚDE AMBIENTAL");
    expect(cargoCurto("Enfermeiro")).toBe("Enfermeiro");
    expect(cargoCurto(null)).toBe("");
    // Sem nada depois do prefixo, fica o texto inteiro.
    expect(cargoCurto("CARGO 3:")).toBe("CARGO 3:");
  });
});

describe("ordenarPorVaga", () => {
  const lista = [
    vaga("182430", 10, 10),
    vaga("182418", 44, 0),
    vaga("182420", 30, 3),
  ];
  const codigos = (o) => ordenarPorVaga(lista, o).map((v) => v.codigo);

  it("banco mantém a ordem; vaga, progresso e pendentes reordenam", () => {
    expect(codigos("banco")).toEqual(["182430", "182418", "182420"]);
    expect(codigos("vaga")).toEqual(["182418", "182420", "182430"]);
    expect(codigos("progresso")).toEqual(["182418", "182420", "182430"]);
    expect(codigos("pendentes")).toEqual(["182418", "182420", "182430"]);
  });

  it("empate fica na ordem do edital e não muda a lista original", () => {
    const empate = [vaga("2", 5, 0), vaga("1", 5, 0)];
    expect(ordenarPorVaga(empate, "pendentes").map((v) => v.codigo)).toEqual([
      "2",
      "1",
    ]);
    expect(empate.map((v) => v.codigo)).toEqual(["2", "1"]);
  });
});

describe("resumoPorVaga", () => {
  it("conta as vagas com pendências e as concluídas", () => {
    expect(
      resumoPorVaga([vaga("1", 10, 10), vaga("2", 44, 0), vaga("3", 30, 3)]),
    ).toBe("3 vagas · 2 com pendências · 1 concluída");
    expect(resumoPorVaga([vaga("1", 2, 2)])).toBe(
      "1 vaga · nenhuma com pendências · 1 concluída",
    );
  });
});

describe("aberto lembrado por usuário", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage?.clear();
  });

  it("fechado por padrão; grava e lê por usuário", () => {
    expect(lerPorVagaAberto("u1")).toBe(false);
    gravarPorVagaAberto("u1", true);
    expect(lerPorVagaAberto("u1")).toBe(true);
    expect(lerPorVagaAberto("u2")).toBe(false);
    gravarPorVagaAberto("u1", false);
    expect(lerPorVagaAberto("u1")).toBe(false);
  });

  it("sem armazenamento (navegação privada): fechado, sem erro", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => gravarPorVagaAberto("u1", true)).not.toThrow();
    expect(lerPorVagaAberto("u1")).toBe(false);
  });
});

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  montarEtapasDosEditais,
  montarGradeDoMes,
} from "../src/lib/calendario-editais.ts";
import { GradeDoMes } from "../src/modulos/cronograma/partes.tsx";
import { definido } from "./definido.ts";

const HOJE = new Date(2026, 10, 6, 12);
const etapas = montarEtapasDosEditais(
  [
    {
      id: "edital-do-teste",
      edital: "1/2026",
      unidade: "DSEI Manaus",
      cronograma_total: 4,
    },
  ],
  [
    [
      {
        atividade: "Resultado de outubro",
        data_inicio: "2026-10-31",
        data_fim: "2026-10-31",
        ordem: 1,
      },
      {
        atividade: "Resultado de novembro",
        data_inicio: "2026-11-06",
        data_fim: "2026-11-06",
        ordem: 2,
      },
      {
        atividade: "Inscrições entre novembro e dezembro",
        data_inicio: "2026-11-30",
        data_fim: "2026-12-02",
        ordem: 3,
      },
      {
        atividade: "Resultado de dezembro",
        data_inicio: "2026-12-04",
        data_fim: "2026-12-04",
        ordem: 4,
      },
    ],
  ],
).etapas;

let raiz: Root | null = null;
const escolher = vi.fn<(dia: string) => void>();

beforeEach(() => {
  const alvo = document.createElement("div");
  document.body.append(alvo);
  raiz = createRoot(alvo);
  escolher.mockClear();
});

afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.replaceChildren();
});

async function desenhar(mes: Date) {
  await act(async () => {
    definido(raiz).render(
      createElement(GradeDoMes, {
        celulas: montarGradeDoMes(mes, etapas, { hoje: HOJE }),
        selecionado: "",
        aoEscolherDia: escolher,
      }),
    );
  });
}

const dias = () => [
  ...document.querySelectorAll<HTMLButtonElement>(".cal-dias [data-dia]"),
];
const dia = (chave: string) =>
  document.querySelector<HTMLButtonElement>(`[data-dia="${chave}"]`);

describe("a vista Mês mostra apenas o mês selecionado", () => {
  it.each([
    { ano: 2026, mes: 1, prefixo: "2026-02", total: 28, coluna: "1" },
    { ano: 2028, mes: 1, prefixo: "2028-02", total: 29, coluna: "3" },
    { ano: 2026, mes: 4, prefixo: "2026-05", total: 31, coluna: "6" },
    { ano: 2026, mes: 8, prefixo: "2026-09", total: 30, coluna: "3" },
    { ano: 2026, mes: 10, prefixo: "2026-11", total: 30, coluna: "1" },
    { ano: 2026, mes: 11, prefixo: "2026-12", total: 31, coluna: "3" },
    { ano: 2027, mes: 0, prefixo: "2027-01", total: 31, coluna: "6" },
  ])(
    "$prefixo: todos os $total dias, sem vizinhos e com a coluna inicial correta",
    async ({ ano, mes, prefixo, total, coluna }) => {
      await desenhar(new Date(ano, mes, 1));
      const botoes = dias();
      expect(botoes.map((botao) => botao.dataset.dia)).toEqual(
        Array.from(
          { length: total },
          (_, indice) => `${prefixo}-${String(indice + 1).padStart(2, "0")}`,
        ),
      );
      expect(definido(botoes[0]).style.gridColumnStart).toBe(coluna);
      expect(
        botoes.slice(1).every((botao) => botao.style.gridColumnStart === ""),
      ).toBe(true);
      expect(document.querySelector(".fora-do-mes")).toBeNull();
      expect(document.querySelectorAll(".cal-dias button")).toHaveLength(
        total,
      );
    },
  );

  it("novembro não inclui as datas nem os eventos de outubro ou dezembro", async () => {
    await desenhar(new Date(2026, 10, 1));
    const grade = definido(document.querySelector(".cal-dias"));
    expect(grade.textContent).toContain("Resultado de novembro");
    expect(grade.textContent).not.toContain("Resultado de outubro");
    expect(grade.textContent).not.toContain("Resultado de dezembro");
    expect(dia("2026-10-31")).toBeNull();
    expect(dia("2026-12-01")).toBeNull();
    expect(dia("2026-12-12")).toBeNull();
    expect(definido(dia("2026-11-06")).classList.contains("hoje")).toBe(true);
    await act(async () => definido(dia("2026-11-06")).click());
    expect(escolher).toHaveBeenCalledExactlyOnceWith("2026-11-06");
  });

  it("preserva as etapas que atravessam meses e move os marcos ao navegar", async () => {
    await desenhar(new Date(2026, 10, 1));
    expect(
      dia("2026-11-30")?.querySelector(".cal-chip-ponta")?.textContent,
    ).toBe("início");
    expect(dia("2026-12-02")).toBeNull();

    await desenhar(new Date(2026, 11, 1));
    expect(dia("2026-11-30")).toBeNull();
    expect(dia("2026-12-01")?.getAttribute("aria-label")).toContain(
      "1 em andamento",
    );
    expect(
      dia("2026-12-02")?.querySelector(".cal-chip-ponta")?.textContent,
    ).toBe("fim");
    expect(dia("2026-12-04")?.textContent).toContain("Resultado de dezembro");

    await desenhar(new Date(2026, 10, 1));
    expect(dias()).toHaveLength(30);
    expect(dia("2026-12-02")).toBeNull();
    expect(dia("2026-11-30")?.textContent).toContain("início");
  });
});

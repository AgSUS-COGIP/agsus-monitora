import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DiferencasPorCargo } from "../../src/modulos/avaliacao-documental/assistente/diferencas-por-cargo.tsx";
import { validarRegraAnalise } from "../../src/lib/avaliacao-documental/regra.js";
import { clicar, digitar } from "../componentes/interacoes.js";

/*
  "Diferenças por cargo" no assistente e no modo avançado: acrescentar uma
  diferença, escolher as vagas do edital e o cargo do quadro, mudar teto e
  faixas dos cursos, um item extra e um requisito — e a regra continua válida.
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const BASE = structuredClone(CASOS.regras["E114-POR-CARGO"]);
delete BASE.por_cargo;

let alvo;
let raiz;
let regra;
beforeEach(() => {
  alvo = document.createElement("div");
  document.body.append(alvo);
  raiz = createRoot(alvo);
  regra = structuredClone(BASE);
});
afterEach(() => {
  act(() => raiz.unmount());
  alvo.remove();
});

async function desenhar() {
  await act(async () => {
    raiz.render(
      createElement(DiferencasPorCargo, {
        regra,
        aoMudar: (nova) => {
          regra = nova;
        },
        vagas: [
          {
            vaga: "182528",
            cargo: "CARGO 15 MOTORISTA - Categoria D",
            colunas: [],
          },
          {
            vaga: "182567",
            cargo: "CARGO 15 MOTORISTA - Categoria D",
            colunas: [],
          },
        ],
        cargosDoQuadro: ["CARGO 15: MOTORISTA - Categoria D (Nível Médio)"],
      }),
    );
  });
}
const porTexto = (seletor, texto) =>
  [...alvo.querySelectorAll(seletor)].find((e) =>
    e.textContent.includes(texto),
  );
const caixa = (texto) =>
  [...alvo.querySelectorAll("label.avd-caixa")]
    .find(
      (l) =>
        l.textContent.trim() === texto ||
        l.textContent.trim().startsWith(`${texto} ·`),
    )
    .querySelector("input");
const campo = (rotulo, dentro = alvo) => {
  const label = [...dentro.querySelectorAll(".ui-campo > label")].find((l) =>
    l.textContent.trim().startsWith(rotulo),
  );
  return label ? dentro.querySelector(`[id="${label.htmlFor}"]`) : null;
};

describe("Diferenças por cargo", () => {
  it("monta a diferença do Motorista D pela tela e a regra fica válida", async () => {
    await desenhar();
    await clicar(porTexto("button", "Diferença por cargo"));
    await desenhar();
    expect(regra.por_cargo).toHaveLength(1);
    alvo.querySelector("details.avd-ast-cargo").open = true;
    await digitar(campo("Nome"), "Cargo 15 — Motorista D");
    await desenhar();
    await clicar(caixa("182528"));
    await desenhar();
    await clicar(caixa("182567"));
    await desenhar();
    await clicar(caixa("CARGO 15"));
    await desenhar();
    expect(regra.por_cargo[0]).toMatchObject({
      rotulo: "Cargo 15 — Motorista D",
      vagas: ["182528", "182567"],
      cargos: ["CARGO 15"],
    });

    const cursos = alvo.querySelector("details.avd-ast-cargo-do-bloco summary");
    expect(cursos).not.toBeNull();
    const doCursos = porTexto(
      "details.avd-ast-cargo-do-bloco",
      "Cursos de aperfeiçoamento",
    );
    doCursos.open = true;
    await clicar(caixa("Faixas e teto próprios do cargo"));
    await desenhar();
    expect(
      regra.por_cargo[0].blocos.CURSOS.faixas.map((f) => f.pontos),
    ).toEqual([2, 4, 6]);
    await digitar(
      campo(
        "Teto",
        porTexto("details.avd-ast-cargo-do-bloco", "Cursos de aperfeiçoamento"),
      ),
      "15",
    );
    await desenhar();
    await clicar(
      [
        ...porTexto(
          "details.avd-ast-cargo-do-bloco",
          "Cursos de aperfeiçoamento",
        ).querySelectorAll("button"),
      ].find((b) => b.textContent.includes("Item extra que pontua")),
    );
    await desenhar();
    const doCursosAgora = porTexto(
      "details.avd-ast-cargo-do-bloco",
      "Cursos de aperfeiçoamento",
    );
    await digitar(campo("Item extra", doCursosAgora), "Certificado UMCQA");
    await desenhar();
    await digitar(
      campo(
        "Pontos",
        porTexto(
          "details.avd-ast-cargo-do-bloco",
          "Cursos de aperfeiçoamento",
        ).querySelector(".avd-ast-cargo-lista"),
      ),
      "5",
    );
    await desenhar();
    expect(regra.por_cargo[0].blocos.CURSOS).toMatchObject({
      teto: 15,
      extras: [{ codigo: "EXTRA_1", rotulo: "Certificado UMCQA", pontos: 5 }],
    });

    await clicar(
      [
        ...porTexto(
          "details.avd-ast-cargo-do-bloco",
          "Requisito específico do cargo",
        ).querySelectorAll("button"),
      ].find((b) => b.textContent.includes("Requisito do cargo")),
    );
    await desenhar();
    const req = porTexto(
      "details.avd-ast-cargo-do-bloco",
      "Requisito específico do cargo",
    );
    await digitar(campo("Requisito", req), "CNH categoria D vigente");
    await desenhar();
    await digitar(
      campo(
        "Motivo da eliminação",
        porTexto(
          "details.avd-ast-cargo-do-bloco",
          "Requisito específico do cargo",
        ),
      ),
      "Não apresentou CNH categoria D vigente.",
    );
    await desenhar();
    expect(regra.por_cargo[0].blocos.REQUISITO_DO_CARGO.requisitos).toEqual([
      {
        codigo: "REQUISITO_1",
        rotulo: "CNH categoria D vigente",
        motivo: "Não apresentou CNH categoria D vigente.",
        item_edital: "",
      },
    ]);
    expect(validarRegraAnalise(regra)).toEqual([]);
  });

  it("tirar a última diferença tira por_cargo da regra", async () => {
    regra.por_cargo = [
      {
        codigo: "CARGO_1",
        rotulo: "X",
        vagas: ["182528"],
        blocos: { EXPERIENCIA: { area: "Motorista" } },
      },
    ];
    await desenhar();
    alvo.querySelector("details.avd-ast-cargo").open = true;
    await clicar(alvo.querySelector('button[aria-label="Tirar a diferença"]'));
    expect(regra.por_cargo).toBeUndefined();
  });
});

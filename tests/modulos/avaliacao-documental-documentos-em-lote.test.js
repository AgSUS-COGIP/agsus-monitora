import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { concluidosDaFila } from "../../src/lib/avaliacao-documental/documentos-em-lote.ts";
import { DocumentosEmLote } from "../../src/modulos/avaliacao-documental/documentos-em-lote.tsx";
import { clicar, digitar, esperar } from "../componentes/interacoes.js";

/*
  A lista dos Espelhos das avaliações concluídas (aba Documentos): busca por
  nome, marcação múltipla e as saídas PDF (uma pessoa), ZIP e impressão.
  Dados fictícios; PDF, ZIP e impressão são dublês.
*/

const concluida = (resultado) => ({ situacao: "CONCLUIDA", resultado });
const PESSOAS = concluidosDaFila([
  {
    vaga: "1",
    codigo: "9001",
    nome: "Ana Conceição",
    ficha: concluida("APTO"),
  },
  { vaga: "1", codigo: "9002", nome: "Bruno Alves", ficha: concluida("APTO") },
  {
    vaga: "2",
    codigo: "9003",
    nome: "Ana Paula",
    ficha: concluida("INAPTO_NOTA"),
  },
]);

let raiz;
let caixa;
afterEach(async () => {
  await act(async () => raiz?.unmount());
  caixa?.remove();
});

async function montar(props) {
  caixa = document.createElement("div");
  document.body.append(caixa);
  raiz = createRoot(caixa);
  await act(async () => {
    raiz.render(
      createElement(DocumentosEmLote, {
        id: "espelhos-concluidos",
        pessoas: PESSOAS,
        vagas: [{ codigo: "1" }, { codigo: "2" }],
        rotuloDoDetalhe: "Resultado",
        rotuloDoDocumento: "espelho",
        tituloDaImpressao: "Espelhos de nota",
        prefixoDoZip: "espelhos",
        edital: "93/2026",
        agora: () => new Date(2026, 9, 29),
        ...props,
      }),
    );
  });
}
const linhas = () =>
  [...caixa.querySelectorAll("tbody tr")].map((tr) => tr.dataset.pessoa);
const acao = (nome) =>
  caixa.querySelector(`[data-acao='espelhos-concluidos-${nome}']`);
const comoDocumentos = async (escolhidas) => ({
  documentos: escolhidas.map((p) => ({ candidato: p.nome })),
  avisos: [],
});

describe("Documentos em lote", () => {
  it("busca por nome, marca os da busca e baixa o ZIP só das marcadas", async () => {
    const montarDocs = vi.fn(comoDocumentos);
    const baixarZip = vi.fn(async (docs) => docs.length);
    await montar({ montar: montarDocs, baixarZip });
    expect(linhas()).toEqual(["9001", "9002", "9003"]);
    expect(acao("zip").disabled).toBe(true);
    await digitar(acao("busca"), "ana");
    expect(linhas()).toEqual(["9001", "9003"]);
    await clicar(acao("marcar-filtradas"));
    expect(acao("marcadas").textContent).toBe("2 marcada(s)");
    expect(acao("pdf").disabled).toBe(true);
    await clicar(acao("zip"));
    await esperar();
    expect(montarDocs.mock.calls[0][0].map((p) => p.codigo)).toEqual([
      "9001",
      "9003",
    ]);
    expect(baixarZip).toHaveBeenCalledWith(
      [{ candidato: "Ana Conceição" }, { candidato: "Ana Paula" }],
      "espelhos-93-2026-2026-10-29.zip",
      expect.any(Object),
    );
    expect(caixa.textContent).toContain("2 espelhos em espelhos-93-2026");
  });

  it("uma marcada: PDF individual; várias: impressão num documento só", async () => {
    const montarDocs = vi.fn(async (escolhidas) => ({
      ...(await comoDocumentos(escolhidas)),
      avisos: ["1 marcada(s) sem ficha concluída disponível agora."],
    }));
    const baixarPdf = vi.fn(async () => "espelho-1-9002.pdf");
    const abrir = vi.fn();
    await montar({ montar: montarDocs, baixarPdf, abrir });
    await clicar(caixa.querySelector("input[aria-label='Marcar 9002']"));
    await clicar(acao("pdf"));
    await esperar();
    expect(baixarPdf).toHaveBeenCalledWith({ candidato: "Bruno Alves" });
    expect(caixa.textContent).toContain(
      "Arquivo preparado: espelho-1-9002.pdf",
    );
    expect(acao("avisos").textContent).toContain("sem ficha concluída");
    await clicar(caixa.querySelector("input[aria-label='Marcar 9001']"));
    await clicar(acao("imprimir"));
    await esperar();
    expect(abrir).toHaveBeenCalledWith(
      [{ candidato: "Ana Conceição" }, { candidato: "Bruno Alves" }],
      { titulo: "Espelhos de nota" },
    );
  });
});

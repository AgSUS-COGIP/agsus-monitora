import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EspelhosEmMassa } from "../../src/modulos/avaliacao-documental/espelhos-em-massa.tsx";
import {
  baixarEspelhoEmPdf,
  baixarZipDosEspelhos,
  espelhoDaFichaGravada,
} from "../../src/modulos/avaliacao-documental/ficha/espelho-de-nota.ts";
import {
  calcularFicha,
  regraDaFicha,
} from "../../src/lib/avaliacao-documental/ficha.js";
import { carregarBibliotecasDoPdf } from "../../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import { unzipSync } from "fflate";
import { clicar, esperar } from "../componentes/interacoes.js";

/*
  Espelhos de nota em massa no formato ZIP (um PDF por candidato): o botão
  "Baixar ZIP" lê as fichas, gera os PDFs com "x de N" e baixa o ZIP com o
  nome do edital e da data; "Imprimir tudo junto" segue abrindo um documento
  só. E o "Baixar PDF" do espelho individual.
*/

const f114 = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
    "utf8",
  ),
);
const MOTORISTA = "CARGO 14: MOTORISTA - Categoria B (Nível Médio)";
const ELIMINADO = {
  nivel: "medio",
  modalidade: "AC",
  vaga: "182513",
  cargo: MOTORISTA,
  blocos: {
    IDENTIDADE: { situacao: "CONFORME" },
    ESCOLARIDADE: { situacao: "CONFORME" },
    REQUISITO_DO_CARGO: {
      situacao: "NAO_CONFORME",
      motivos: ["OUTRO"],
      motivo_livre: "CNH cortada.",
    },
  },
  titulos: [],
  cursos: [],
  vinculos: [],
};

const linha = (codigo, nome) => ({
  id: `f-${codigo}`,
  codigo,
  nome,
  vaga: "182513",
  cargo: MOTORISTA,
  modalidade: "AC",
  posicao: 1,
  art: 10,
  resultado: "INAPTO_REQUISITO",
  nota_final: 0,
  regra: "r1:1",
  declarada: {},
  lancamento: structuredClone(ELIMINADO),
});

function rpcFalso() {
  return vi.fn(async () => ({
    edital: { id: "e114", rotulo: "114/2026", area: "projetos" },
    documental: { nota_minima: 15 },
    regras: { "r1:1": structuredClone(f114.regra) },
    fichas: [linha("7001", "Ana Lúcia"), linha("7002", "Bruno")],
    nao_concluidos: [],
    proximo: null,
  }));
}

const FILA = [
  { vaga: "182513", codigo: "7001", ficha: { situacao: "CONCLUIDA" } },
  { vaga: "182513", codigo: "7002", ficha: { situacao: "CONCLUIDA" } },
];

let raiz = null;
let lugar = null;
afterEach(() => {
  act(() => raiz?.unmount());
  lugar?.remove();
  raiz = null;
});

async function montar(props) {
  lugar = document.createElement("div");
  document.body.append(lugar);
  raiz = createRoot(lugar);
  await act(async () => {
    raiz.render(
      createElement(EspelhosEmMassa, {
        editalId: "e114",
        vagas: [{ codigo: "182513", cargo: MOTORISTA }],
        fila: FILA,
        aoFechar: () => {},
        agora: () => new Date(2026, 9, 19, 9, 30),
        ...props,
      }),
    );
  });
}
const botao = (seletor) => document.querySelector(seletor);

describe("Espelhos de nota em massa: ZIP", () => {
  it("o padrão é o ZIP: gera um PDF por candidato com progresso e baixa", async () => {
    const rpc = rpcFalso();
    let continuar;
    const progresso = [];
    const baixarZip = vi.fn(
      (espelhos, nome, { aoProgredir }) =>
        new Promise((resolver) => {
          aoProgredir(1, espelhos.length);
          continuar = () => resolver(espelhos.length);
        }),
    );
    await montar({ rpc, baixarZip, abrir: vi.fn() });
    expect(botao("[data-acao='gerar-espelhos']").textContent).toContain(
      "Baixar ZIP",
    );
    await clicar(botao("[data-acao='gerar-espelhos']"));
    expect(baixarZip).toHaveBeenCalledTimes(1);
    const [espelhos, nome] = baixarZip.mock.calls[0];
    expect(espelhos.map((e) => e.codigoDoCandidato)).toEqual(["7001", "7002"]);
    expect(nome).toBe("espelhos-114-2026-2026-10-19.zip");
    progresso.push(botao("[data-acao='espelhos-pdfs']").textContent);
    expect(progresso[0]).toContain("1 de 2 PDFs");
    await esperar(() => continuar());
    expect(botao("[data-acao='espelhos-pdfs']")).toBeNull();
    expect(document.body.textContent).toContain(
      "2 PDF(s) em espelhos-114-2026-2026-10-19.zip",
    );
    expect(botao("[data-acao='espelhos-de-novo']").textContent).toBe(
      "Baixar de novo",
    );
  });

  it("com a vaga escolhida, o nome do ZIP leva a vaga", async () => {
    const baixarZip = vi.fn(async (espelhos) => espelhos.length);
    await montar({ rpc: rpcFalso(), baixarZip });
    const select = document.querySelector("select");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      ).set.call(select, "182513");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await clicar(botao("[data-acao='gerar-espelhos']"));
    expect(baixarZip.mock.calls[0][1]).toBe(
      "espelhos-114-2026-vaga-182513-2026-10-19.zip",
    );
  });

  it("Imprimir tudo junto segue abrindo um documento só", async () => {
    const abrir = vi.fn();
    const baixarZip = vi.fn();
    await montar({ rpc: rpcFalso(), baixarZip, abrir });
    await clicar(botao("[data-valor='imprimir']"));
    expect(botao("[data-acao='gerar-espelhos']").textContent).toContain(
      "Gerar e imprimir",
    );
    await clicar(botao("[data-acao='gerar-espelhos']"));
    expect(baixarZip).not.toHaveBeenCalled();
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir.mock.calls[0][0]).toHaveLength(2);
    expect(botao("[data-acao='espelhos-de-novo']").textContent).toBe(
      "Abrir de novo",
    );
  });
});

const libs = await carregarBibliotecasDoPdf();

describe("baixar o PDF e o ZIP (sem rede: marca e download falsos)", () => {
  const marca = async () => ({ cabecalho: "AGÊNCIA DE TESTE", logo: null });

  it("baixarZipDosEspelhos baixa um application/zip com um PDF por espelho", async () => {
    const espelhos = [linha("7001", "Ana"), linha("7002", "Bia")].map((f) =>
      espelhoDaFichaGravada(
        f,
        structuredClone(f114.regra),
        {},
        {
          rotulo: "114/2026",
        },
      ),
    );
    const baixar = vi.fn();
    const n = await baixarZipDosEspelhos(espelhos, "x.zip", {
      carregar: async () => libs,
      baixar,
      marca,
    });
    expect(n).toBe(2);
    const [bytes, nome, tipo] = baixar.mock.calls[0];
    expect([nome, tipo]).toEqual(["x.zip", "application/zip"]);
    expect(Object.keys(unzipSync(bytes))).toEqual([
      "espelho-182513-7001-ana.pdf",
      "espelho-182513-7002-bia.pdf",
    ]);
  });

  it("baixarEspelhoEmPdf baixa o PDF da ficha concluída com o nome legível", async () => {
    const regra = regraDaFicha(structuredClone(f114.regra), ELIMINADO);
    const avaliacao = calcularFicha(regra, ELIMINADO, { nota_minima: 15 });
    const baixar = vi.fn();
    const nome = await baixarEspelhoEmPdf(
      {
        regra,
        lancamento: ELIMINADO,
        avaliacao,
        declarada: null,
        dados: { edital: { rotulo: "114/2026", area: "projetos" } },
      },
      {
        nome: "José da Silva",
        codigo: "7003",
        vaga: "182513",
        cargo: MOTORISTA,
        tp_resultado: avaliacao.resultado,
      },
      { carregar: async () => libs, baixar, marca },
    );
    expect(nome).toBe("espelho-182513-7003-jose-da-silva.pdf");
    const [bytes, , tipo] = baixar.mock.calls[0];
    expect(tipo).toBe("application/pdf");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

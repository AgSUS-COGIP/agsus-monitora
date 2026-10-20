import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelatorioDeMotivos } from "../../src/modulos/avaliacao-documental/relatorio-de-motivos.tsx";
import { clicar, escolher, esperar } from "../componentes/interacoes.js";

/*
  Relatório de motivos (gaveta da coordenação): o atalho "Outro motivo por
  critério" pede ao banco Identidade + OUTRO nas concluídas, lê todas as
  páginas, mostra a contagem, a tabela com os textos e os textos agrupados;
  o CSV sai do que foi lido, sem nova chamada.
*/
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { regra } = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
    "utf8",
  ),
);

const ficha = (codigo, texto) => ({
  id: `f-${codigo}`,
  codigo,
  nome: `Candidato ${codigo}`,
  vaga: "182502",
  cargo: "CARGO 13",
  situacao: "CONCLUIDA",
  resultado: "INAPTO_REQUISITO",
  nota_final: 0,
  avaliador: "Emanuel Serrano",
  concluida_em: "2026-10-16T19:30:22Z",
  blocos: {
    IDENTIDADE: {
      situacao: "NAO_CONFORME",
      motivos: ["ILEGIVEL", "OUTRO"],
      motivo_livre: texto,
    },
  },
});

function rpcFalso() {
  return vi.fn(async (_nome, { p_filtros }) =>
    p_filtros.apos
      ? {
          fichas: [ficha("3", "Frente sem verso.")],
          total: null,
          proximo: null,
        }
      : {
          fichas: [
            ficha("1", "Documento não integral."),
            ficha("2", "documento NÃO integral"),
          ],
          total: 3,
          avaliadores: [{ usuario: "u1", nome: "Emanuel Serrano" }],
          proximo: "f-2",
        },
  );
}

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
      createElement(RelatorioDeMotivos, {
        editalId: "e114",
        edital: "114/2026",
        regra,
        vagas: [{ codigo: "182502", cargo: "CARGO 13" }],
        aoFechar: () => {},
        agora: () => new Date(2026, 9, 20, 9, 0),
        ...props,
      }),
    );
  });
}
const $ = (seletor) => document.querySelector(seletor);

describe("Relatório de motivos", () => {
  it("o atalho Outro motivo por critério lê todas as páginas e agrupa os textos", async () => {
    const rpc = rpcFalso();
    await montar({ rpc });
    await clicar($("[data-atalho='outro-por-criterio']"));
    await esperar();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).toEqual([
      "listar_relatorio_de_motivos",
      {
        p_edital: "e114",
        p_filtros: {
          limite: 500,
          blocos: ["IDENTIDADE"],
          motivo: "OUTRO",
          situacoes_ficha: ["CONCLUIDA"],
        },
      },
    ]);
    expect(rpc.mock.calls[1][1].p_filtros.apos).toBe("f-2");
    expect($("[data-kpi='fichas'] .ui-kpi-valor").textContent).toBe("3");
    expect($("[data-kpi='textos-distintos'] .ui-kpi-valor").textContent).toBe(
      "2",
    );
    // Os textos agrupados, do que mais repete para o que menos.
    const grupos = [...document.querySelectorAll("[data-grupo-quantidade]")];
    expect(grupos.map((g) => g.dataset.grupoQuantidade)).toEqual(["2", "1"]);
    // O critério e o motivo escolhidos ficam nos filtros.
    expect($("[data-filtro='criterio']").value).toBe("IDENTIDADE");
    expect($("[data-filtro='motivo']").value).toBe("OUTRO");
    // A tabela mostra o texto do motivo, não o código.
    const linha = $("tr[data-codigo='1']");
    expect(linha.textContent).toContain("Documento não integral");
    expect(linha.textContent).not.toContain("ILEGIVEL");
    // O filtro de avaliador passa a listar quem concluiu fichas.
    expect(
      [...$("[data-filtro='avaliador']").options].map((o) => o.textContent),
    ).toEqual(["Todos", "Emanuel Serrano"]);
  });

  it("CSV e XLSX saem do que foi lido, sem ir ao banco de novo", async () => {
    const rpc = rpcFalso();
    const baixar = vi.fn();
    await montar({ rpc, baixar });
    expect($("[data-acao='relatorio-csv']")).toBeNull();
    await clicar($("[data-atalho='outro-por-criterio']"));
    await esperar();
    const chamadas = rpc.mock.calls.length;
    await clicar($("[data-acao='relatorio-csv']"));
    await clicar($("[data-acao='relatorio-xlsx']"));
    expect(rpc).toHaveBeenCalledTimes(chamadas);
    const [csv, nome, tipo] = baixar.mock.calls[0];
    expect(nome).toBe(
      "relatorio-de-motivos-114-2026-identidade-2026-10-20.csv",
    );
    expect(tipo).toContain("text/csv");
    expect(csv.startsWith("\uFEFFCódigo;")).toBe(true);
    expect(csv.trimEnd().split("\r\n")).toHaveLength(4);
    expect(baixar.mock.calls[1][1]).toBe(
      "relatorio-de-motivos-114-2026-identidade-2026-10-20.xlsx",
    );
  });

  it("filtros manuais: o critério troca a lista de motivos e Gerar relatório pede ao banco", async () => {
    const rpc = vi.fn(async () => ({ fichas: [], total: 0, proximo: null }));
    await montar({ rpc });
    await escolher($("[data-filtro='criterio']"), "CURSOS");
    const motivos = [...$("[data-filtro='motivo']").options].map(
      (o) => o.value,
    );
    expect(motivos).toContain("CAPACITACAO_UMCQA");
    expect(motivos).not.toContain("ILEGIVEL");
    expect(motivos.at(-1)).toBe("OUTRO");
    await escolher($("[data-filtro='resultado']"), "APTO");
    await clicar($("[data-acao='gerar-relatorio']"));
    await esperar();
    expect(rpc.mock.calls[0][1].p_filtros).toEqual({
      limite: 500,
      blocos: ["CURSOS"],
      resultados: ["APTO"],
      situacoes_ficha: ["CONCLUIDA"],
    });
    expect(document.body.textContent).toContain(
      "Nenhuma ficha com estes filtros.",
    );
  });

  it("erro do banco (quem não coordena) aparece como alerta", async () => {
    const rpc = vi.fn(async () => {
      throw new Error(
        "Só o administrador e a coordenação do edital tiram o relatório de motivos",
      );
    });
    await montar({ rpc });
    await clicar($("[data-acao='gerar-relatorio']"));
    await esperar();
    expect($("[role='alert']").textContent).toContain(
      "Só o administrador e a coordenação do edital",
    );
  });
});

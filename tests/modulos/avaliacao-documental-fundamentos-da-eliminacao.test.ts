import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FundamentosDaEliminacao } from "../../src/modulos/avaliacao-documental/fundamentos-da-eliminacao.tsx";
import { clicar, digitar } from "../componentes/interacoes.ts";

/*
  Quadro "Fundamento das eliminações" (aba Eliminados da Triagem, issue #593):
  quem pode conferir (o banco diz, pode_conferir) vê o botão; o formulário começa
  vazio (nada presumido), avisa e exige justificativa para o item da nota mínima
  do lote, e grava por conferir_fundamento_da_eliminacao. Dados fictícios.
*/

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const EDITAL = "aaaaaaaa-0000-4000-8000-000000000001";

const quadro = (podeConferir: boolean) => ({
  pode_conferir: podeConferir,
  regra: { versao: 2, situacao: "CONFERIDA", item_da_nota: "8.2.6" },
  motivos: [
    {
      codigo: "QUESTIONARIO",
      motivo: "Não finalizou o questionário",
      item_na_regra: "8.2.6",
      eliminados: 3,
      fundamento: null,
    },
    {
      codigo: "CANCELADO",
      motivo: "Cancelou a inscrição",
      item_na_regra: null,
      eliminados: 1,
      fundamento: {
        situacao: "CONFERIDO",
        item_edital: "6.4",
        versao_regra: 2,
        fonte: "Edital nº 1/2099 publicado",
      },
    },
  ],
  fora_da_regra: [],
  fora_do_lote_por_nota: 5,
  historico: [],
});

let raiz: Root | undefined;
let caixa: HTMLDivElement | undefined;
afterEach(async () => {
  await act(async () => raiz?.unmount());
  caixa?.remove();
  document.body.innerHTML = "";
});

async function montar(podeConferir: boolean, rpc = vi.fn()) {
  rpc.mockImplementation(async (nome: string) =>
    nome === "obter_fundamentos_da_eliminacao"
      ? quadro(podeConferir)
      : { ok: true },
  );
  caixa = document.createElement("div");
  document.body.append(caixa);
  raiz = createRoot(caixa);
  await act(async () =>
    raiz!.render(
      createElement(FundamentosDaEliminacao, {
        pre: { rpc },
        editalId: EDITAL,
        leitura: "1",
      }),
    ),
  );
  return rpc;
}

describe("Fundamento das eliminações", () => {
  it("mostra o fundamento de cada motivo e quem ficou fora do lote pela nota, sem botão para quem não pode", async () => {
    await montar(false);
    const linhas = [...document.querySelectorAll("tr[data-motivo]")].map(
      (tr) => tr.textContent,
    );
    expect(linhas[0]).toContain("Sem fundamento conferido");
    expect(linhas[1]).toContain("Item 6.4 · regra v2");
    expect(
      document.querySelector('[data-acao="fora-do-lote-por-nota"]')
        ?.textContent,
    ).toMatch(/5 inscrito\(s\) fora do lote pela nota: não são eliminados/);
    expect(
      document.querySelector('[data-acao="conferir-fundamento"]'),
    ).toBeNull();
  });

  it("o formulário começa vazio e o item da nota exige justificativa antes de gravar", async () => {
    const rpc = await montar(true);
    await clicar(
      document.querySelector(
        'tr[data-motivo="QUESTIONARIO"] [data-acao="conferir-fundamento"]',
      ),
    );
    const item = document.querySelector<HTMLInputElement>(
      '[data-acao="fundamento-item"]',
    );
    expect(item?.value).toBe(""); // a regra cita 8.2.6, mas nada vem preenchido
    await digitar(item, "8.2.6");
    await digitar(
      document.querySelector('[data-acao="fundamento-fonte"]'),
      "Edital nº 1/2099 publicado",
    );
    expect(document.body.textContent).toContain(
      "O item 8.2.6 é o da nota mínima do lote",
    );
    await clicar(document.querySelector('[data-acao="gravar-fundamento"]'));
    expect(rpc).not.toHaveBeenCalledWith(
      "conferir_fundamento_da_eliminacao",
      expect.anything(),
    );

    await digitar(item, "6.3");
    await clicar(document.querySelector('[data-acao="gravar-fundamento"]'));
    expect(rpc).toHaveBeenCalledWith("conferir_fundamento_da_eliminacao", {
      p_edital: EDITAL,
      p_motivo: "QUESTIONARIO",
      p_versao_regra: 2,
      p_item_edital: "6.3",
      p_fonte: "Edital nº 1/2099 publicado",
      p_justificativa: null,
    });
    // Releu o quadro depois de gravar.
    expect(
      rpc.mock.calls.filter(
        ([nome]) => nome === "obter_fundamentos_da_eliminacao",
      ),
    ).toHaveLength(2);
  });

  it("banco sem a migration: sem quadro e sem erro na tela", async () => {
    const rpc = vi.fn(async () => {
      throw Object.assign(new Error("função ausente"), { code: "PGRST202" });
    });
    caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    await act(async () =>
      raiz!.render(
        createElement(FundamentosDaEliminacao, {
          pre: { rpc },
          editalId: EDITAL,
          leitura: "1",
        }),
      ),
    );
    expect(caixa.textContent).toBe("");
  });
});

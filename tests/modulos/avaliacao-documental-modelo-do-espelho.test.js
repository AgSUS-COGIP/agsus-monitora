import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TEXTOS_PADRAO_DO_ESPELHO } from "../../src/lib/avaliacao-documental/modelo-do-espelho.ts";
import { ModeloDoEspelhoDeNota } from "../../src/modulos/avaliacao-documental/modelo-do-espelho.tsx";
import {
  mensagemDoErroDoModelo,
  textosParaOEspelho,
} from "../../src/modulos/avaliacao-documental/modelo-do-espelho-no-banco.ts";
import { clicar, digitar, esperar } from "../componentes/interacoes.js";

/*
  O editor "Modelo do espelho de nota": abre o modelo do edital, mostra a
  prévia com dados fictícios, salva só as diferenças do padrão com a versão
  aberta, "Restaurar padrão", conflito (PT409) pede para recarregar; e a
  leitura para montar o espelho nunca falha (sem RPC = padrão).
*/

let raiz = null;
let lugar = null;
afterEach(() => {
  act(() => raiz?.unmount());
  lugar?.remove();
  raiz = null;
});

function rpcFalso({
  versao = 2,
  textos = { titulo: "Título do edital" },
  salvar,
} = {}) {
  return vi.fn(async (nome, args) => {
    if (nome === "obter_modelo_espelho_nota")
      return {
        versao,
        textos,
        atualizado_em: "2026-10-19T12:00:00Z",
        atualizado_por: "Gestão Pessoal",
        pode_editar: true,
      };
    if (nome === "salvar_modelo_espelho_nota") {
      if (salvar) return salvar(args);
      return {
        versao: args.p_versao_atual + 1,
        textos: args.p_textos,
        atualizado_em: "2026-10-19T12:05:00Z",
        atualizado_por: "Gestão Pessoal",
        pode_editar: true,
      };
    }
    throw new Error(`rpc inesperada ${nome}`);
  });
}

async function montar(rpc) {
  lugar = document.createElement("div");
  document.body.append(lugar);
  raiz = createRoot(lugar);
  await act(async () => {
    raiz.render(
      createElement(ModeloDoEspelhoDeNota, {
        editalId: "e114",
        rpc,
        aoFechar: () => {},
        marca: () => ({ cabecalho: "AGÊNCIA DE TESTE" }),
      }),
    );
  });
  await esperar();
}
const campo = (chave) => document.querySelector(`[data-campo='${chave}']`);
const previa = () =>
  document.querySelector(".avd-modelo-espelho-folha").getAttribute("srcdoc");

describe("editor do modelo do espelho", () => {
  it("abre o modelo do edital com a prévia e salva só as diferenças com a versão aberta", async () => {
    const rpc = rpcFalso();
    await montar(rpc);
    expect(rpc).toHaveBeenCalledWith("obter_modelo_espelho_nota", {
      p_edital: "e114",
    });
    expect(
      document.querySelector(".ui-modal-institucional-topo h2")?.textContent,
    ).toBe("Modelo do espelho de nota");
    expect(
      document.querySelector(".ui-modal-institucional-rodape"),
    ).not.toBeNull();
    expect(
      document.querySelector(".ui-modal-institucional-conteudo"),
    ).not.toBeNull();
    expect(
      document.querySelector(
        ".ui-modal-institucional-acoes [data-acao='modelo-espelho-salvar']",
      ),
    ).not.toBeNull();
    expect(campo("titulo").value).toBe("Título do edital");
    expect(previa()).toContain("<h1>Título do edital</h1>");
    expect(previa()).toContain("AGÊNCIA DE TESTE");
    const salvar = document.querySelector(
      "[data-acao='modelo-espelho-salvar']",
    );
    expect(salvar.disabled).toBe(true);

    await digitar(campo("rodape"), "Rodapé do edital.");
    expect(previa()).toContain("Rodapé do edital.");
    await clicar(campo("mostrar_autodeclarada"));
    expect(previa()).not.toContain("autodeclarada");
    expect(salvar.disabled).toBe(false);
    await clicar(salvar);
    await esperar();
    expect(rpc).toHaveBeenCalledWith("salvar_modelo_espelho_nota", {
      p_edital: "e114",
      p_textos: {
        titulo: "Título do edital",
        rodape: "Rodapé do edital.",
        mostrar_autodeclarada: false,
      },
      p_versao_atual: 2,
    });
    expect(document.body.textContent).toContain("Modelo salvo (versão 3)");
  });

  it("campo inválido trava o salvar e mostra o erro", async () => {
    await montar(rpcFalso());
    await digitar(campo("saudacao"), "Prezado(a),");
    expect(document.body.textContent).toContain("Inclua {candidato}");
    expect(
      document.querySelector("[data-acao='modelo-espelho-salvar']").disabled,
    ).toBe(true);
  });

  it("Restaurar padrão volta aos textos de hoje e salva {}", async () => {
    const rpc = rpcFalso();
    await montar(rpc);
    await clicar(document.querySelector("[data-acao='modelo-espelho-padrao']"));
    expect(campo("titulo").value).toBe(TEXTOS_PADRAO_DO_ESPELHO.titulo);
    await clicar(document.querySelector("[data-acao='modelo-espelho-salvar']"));
    await esperar();
    expect(rpc.mock.calls.at(-1)).toEqual([
      "salvar_modelo_espelho_nota",
      { p_edital: "e114", p_textos: {}, p_versao_atual: 2 },
    ]);
  });

  it("conflito de versão (PT409) pede para recarregar", async () => {
    const rpc = rpcFalso({
      salvar: () => {
        throw Object.assign(new Error("alterado"), { code: "PT409" });
      },
    });
    await montar(rpc);
    await digitar(campo("titulo"), "Mais um");
    await clicar(document.querySelector("[data-acao='modelo-espelho-salvar']"));
    await esperar();
    expect(document.body.textContent).toContain(
      "O modelo foi alterado em outra aba ou por outra pessoa",
    );
  });
});

describe("textosParaOEspelho", () => {
  it("lê o modelo do edital", async () => {
    const t = await textosParaOEspelho(rpcFalso(), "e114");
    expect(t.titulo).toBe("Título do edital");
    expect(t.rodape).toBe(TEXTOS_PADRAO_DO_ESPELHO.rodape);
  });

  it("sem RPC, sem edital ou com erro: o padrão", async () => {
    const falha = vi.fn(async () => {
      throw Object.assign(new Error("função não existe"), { code: "PGRST202" });
    });
    expect(await textosParaOEspelho(falha, "e114")).toEqual(
      TEXTOS_PADRAO_DO_ESPELHO,
    );
    expect(await textosParaOEspelho(null, "e114")).toEqual(
      TEXTOS_PADRAO_DO_ESPELHO,
    );
    expect(await textosParaOEspelho(falha, "")).toEqual(
      TEXTOS_PADRAO_DO_ESPELHO,
    );
  });

  it("mensagem de erro comum", () => {
    expect(mensagemDoErroDoModelo(new Error("x"))).toBe(
      "Não foi possível salvar o modelo: x",
    );
  });
});

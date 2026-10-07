import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { secaoDeConfiguracaoPermitida } from "../../src/lib/access-roles.js";
import { SECOES_DA_AYA } from "../../src/lib/aya-paginas.js";
import {
  CHAVE_DA_PREFERENCIA_PESSOAL,
  CHAVE_DAS_COMEMORACOES,
} from "../../src/lib/catalogo-de-comemoracoes.ts";
import { SecaoComemoracoes } from "../../src/modulos/configuracoes/comemoracoes.tsx";
import { SECOES } from "../../src/modulos/configuracoes/secoes.js";
import { clicar, digitar, escolher } from "../componentes/interacoes.js";

/*
  Configurações › Comemorações: quem edita configurações vê a seção; mudar
  um marco vai para o rascunho como o JSON da chave comemoracoes_marcos
  (publicado depois, com motivo e histórico); "Testar" e o palco soltam na
  hora sem tocar no rascunho; a preferência pessoal fica neste navegador.
*/

function criarEstado(valorInicial = "") {
  let valor = valorInicial;
  let versao = 0;
  const ouvintes = new Set();
  const mudarCampo = vi.fn((chave, novo) => {
    if (chave === CHAVE_DAS_COMEMORACOES) valor = novo;
    versao += 1;
    ouvintes.forEach((o) => o());
  });
  return {
    assinar: (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    obter: () => versao,
    valor: (chave) => (chave === CHAVE_DAS_COMEMORACOES ? valor : ""),
    mudarCampo,
    atual: () => valor,
  };
}

function janelaFalsa({ movimento = true } = {}) {
  const guardado = new Map();
  return {
    matchMedia: () => ({ matches: !movimento }),
    localStorage: {
      getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
      setItem: (k, v) => guardado.set(k, String(v)),
      removeItem: (k) => guardado.delete(k),
    },
    guardado,
  };
}

let raiz = null;
let host = null;

async function montar(props) {
  host = document.createElement("div");
  document.body.append(host);
  raiz = createRoot(host);
  await act(async () => {
    raiz.render(createElement(SecaoComemoracoes, props));
  });
  return host;
}

afterEach(() => {
  act(() => raiz?.unmount());
  host?.remove();
  raiz = null;
});

const marco = (id) => host.querySelector(`[data-marco="${id}"]`);

describe("seção Comemorações", () => {
  it("é uma seção de Configurações de quem edita configurações, com verbete da Aya", () => {
    expect(SECOES.map((s) => s.id)).toContain("comemoracoes");
    expect(SECOES_DA_AYA.comemoracoes.nome).toBe("Comemorações");
    const admin = { perfil: "admin" };
    const editor = {
      permissoes: { configuracoes: "editor" },
    };
    const leitor = {
      permissoes: { configuracoes: "leitor", acessos: "editor" },
    };
    expect(secaoDeConfiguracaoPermitida(admin, "comemoracoes")).toBe(true);
    expect(secaoDeConfiguracaoPermitida(editor, "comemoracoes")).toBe(true);
    expect(secaoDeConfiguracaoPermitida(leitor, "comemoracoes")).toBe(false);
  });

  it("lista os marcos do catálogo com o padrão", async () => {
    const estado = criarEstado();
    await montar({ estado, testar: vi.fn(), janela: janelaFalsa() });
    expect(host.querySelectorAll(".comemoracoes-marco")).toHaveLength(7);
    expect(
      marco("vaga-pronta").querySelector(
        "#comemoracoesMarco-vaga-pronta-intensidade",
      ).value,
    ).toBe("suave");
  });

  it("mudar um marco vai para o rascunho como JSON (só o que difere)", async () => {
    const estado = criarEstado();
    await montar({ estado, testar: vi.fn(), janela: janelaFalsa() });
    await escolher(
      host.querySelector("#comemoracoesMarco-fila-zerada-efeito"),
      "estrelas",
    );
    await digitar(
      host.querySelector("#comemoracoesMarco-fila-zerada-duracao"),
      "9",
    );
    await clicar(host.querySelector("#comemoracoesMarco-fim-do-tour-ligado"));
    expect(JSON.parse(estado.atual())).toEqual({
      marcos: {
        "fila-zerada": { efeito: "estrelas", duracaoS: 9 },
        "fim-do-tour": { ligado: false },
      },
    });
    // Desligado, os campos do marco somem.
    expect(
      marco("fim-do-tour").querySelector(".comemoracoes-marco__campos"),
    ).toBeNull();
  });

  it("Testar solta com as opções da tela e não toca no rascunho", async () => {
    const estado = criarEstado(
      JSON.stringify({
        marcos: { "edital-concluido": { efeito: "coracoes", som: true } },
      }),
    );
    const testar = vi.fn();
    await montar({ estado, testar, janela: janelaFalsa() });
    await clicar(
      marco("edital-concluido").querySelector(".comemoracoes-testar"),
    );
    expect(testar).toHaveBeenCalledWith({
      texto: "Edital 100% analisado",
      efeito: "coracoes",
      intensidade: "normal",
      duracaoMs: null,
      som: true,
      forma: "coracao",
    });
    expect(estado.mudarCampo).not.toHaveBeenCalled();
  });

  it("o palco de testes solta o efeito escolhido, sem gravar", async () => {
    const estado = criarEstado();
    const testar = vi.fn();
    await montar({ estado, testar, janela: janelaFalsa() });
    await escolher(host.querySelector("#comemoracoesPalcoEfeito"), "combinado");
    await escolher(
      host.querySelector("#comemoracoesPalcoIntensidade"),
      "festa",
    );
    await digitar(host.querySelector("#comemoracoesPalcoDuracao"), "10");
    await clicar(host.querySelector(".comemoracoes-palco__soltar"));
    expect(testar).toHaveBeenCalledWith(
      expect.objectContaining({
        efeito: "combinado",
        intensidade: "festa",
        duracaoMs: 10000,
        som: false,
      }),
    );
    expect(estado.mudarCampo).not.toHaveBeenCalled();
  });

  it("marcos personalizados: adiciona, valida e remove", async () => {
    const estado = criarEstado();
    await montar({ estado, testar: vi.fn(), janela: janelaFalsa() });
    const adicionar = [...host.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Adicionar marco"),
    );
    await clicar(adicionar);
    expect(host.querySelector('[role="alert"]').textContent).toContain(
      "Dê um nome",
    );
    await digitar(
      host.querySelector("#comemoracoesPessoal-pessoal-1-nome"),
      "Edital 12",
    );
    await digitar(
      host.querySelector("#comemoracoesPessoal-pessoal-1-edital"),
      "012/2026",
    );
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(JSON.parse(estado.atual()).personalizados[0]).toMatchObject({
      id: "pessoal-1",
      nome: "Edital 12",
      tipo: "edital-contratados",
      edital: "012/2026",
      meta: 10,
    });
    await clicar(host.querySelector('[aria-label="Remover Edital 12"]'));
    expect(estado.atual()).toBe("");
  });

  it("a preferência pessoal fica neste navegador; movimento reduzido avisa", async () => {
    const janela = janelaFalsa({ movimento: false });
    await montar({ estado: criarEstado(), testar: vi.fn(), janela });
    expect(host.textContent).toContain("Movimento reduzido");
    const caixa = [...host.querySelectorAll("label")]
      .find((l) => l.textContent.includes("Mostrar comemorações para mim"))
      .querySelector("input");
    expect(caixa.checked).toBe(true);
    await clicar(caixa);
    expect(janela.guardado.get(CHAVE_DA_PREFERENCIA_PESSOAL)).toBe("0");
    expect(caixa.checked).toBe(false);
  });
});

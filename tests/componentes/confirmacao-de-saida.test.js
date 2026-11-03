import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarEstadoDasConfiguracoes } from "../../src/modulos/configuracoes/estado.ts";
import { montarAvisos } from "../../src/app/casca/avisos.tsx";
import {
  obterSaida,
  redefinirSaida,
  sairDoSistema,
  temConfiguracaoNaoSalva,
} from "../../src/app/casca/saida.ts";
import {
  deveAlternarTema,
  estadoDoSeletorDeTema,
  OPCOES_DE_TEMA,
} from "../../src/componentes/barra-lateral/seletor-de-tema.ts";
import { clicar, teclar } from "./interacoes.js";

/*
  O Sair confirmado e o seletor de tema do rodapé. Eram o legado
  `src/modules/nielsen-shell-ux.js` (diálogo por `insertAdjacentHTML`,
  ouvintes no documento); agora o diálogo é React, nos avisos da casca
  (`confirmacao-de-saida.tsx`), com o estado em `saida.ts`. Os ids, as
  classes e os `data-shell-logout-*` são os mesmos (CSS e e2e).
*/

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let montagem = null;
const dialogo = () => document.getElementById("shellLogoutDialog");
const saindo = () => document.getElementById("shellSignoutBusy");

beforeEach(async () => {
  document.body.innerHTML =
    '<div id="avisosApp"></div><button id="quemAbriu" type="button">Sair</button><details id="topUserMenu" open></details>';
  await act(async () => {
    montagem = montarAvisos();
  });
});

afterEach(async () => {
  await act(async () => montagem?.desmontar());
  montagem = null;
  await act(async () => redefinirSaida());
  delete window.monitoraToast;
  vi.restoreAllMocks();
});

/* Pede o Sair com o foco no botão que abriu, como o rodapé da barra faz. */
async function pedirSaida(encerrar = vi.fn()) {
  document.getElementById("quemAbriu").focus();
  let resultado;
  await act(async () => {
    resultado = sairDoSistema({ encerrar });
  });
  return { resultado, encerrar };
}

describe("o diálogo do Sair", () => {
  it("nasce fechado, com a marcação de sempre", () => {
    expect(dialogo()).not.toBeNull();
    expect(dialogo().hidden).toBe(true);
    expect(saindo().hidden).toBe(true);
    expect(
      dialogo().querySelector('[role="dialog"]').getAttribute("aria-modal"),
    ).toBe("true");
    expect(
      document.querySelector("[data-shell-logout-confirm]").textContent,
    ).toBe("Sair");
    expect(document.getElementById("shellLogoutTitle").textContent).toBe(
      "Deseja realmente sair?",
    );
  });

  it("abre com o foco em Continuar no sistema; cancelar não encerra e devolve o foco", async () => {
    const { resultado, encerrar } = await pedirSaida();
    expect(dialogo().hidden).toBe(false);
    expect(document.activeElement.textContent).toBe("Continuar no sistema");

    await clicar(document.querySelector(".shell-confirm-cancel"));
    await expect(resultado).resolves.toBe(false);
    expect(encerrar).not.toHaveBeenCalled();
    expect(dialogo().hidden).toBe(true);
    expect(document.activeElement.id).toBe("quemAbriu");
  });

  it("Esc e o fundo também cancelam", async () => {
    const primeiro = await pedirSaida();
    await teclar(document, "Escape");
    await expect(primeiro.resultado).resolves.toBe(false);
    expect(dialogo().hidden).toBe(true);

    const segundo = await pedirSaida();
    await clicar(document.querySelector(".shell-confirm-backdrop"));
    await expect(segundo.resultado).resolves.toBe(false);
    expect(segundo.encerrar).not.toHaveBeenCalled();
  });

  it("confirmar fecha o menu do perfil, mostra 'Saindo do sistema…' e encerra a sessão", async () => {
    let terminar;
    const encerrar = vi.fn(
      () =>
        new Promise((resolver) => {
          terminar = resolver;
        }),
    );
    const { resultado } = await pedirSaida(encerrar);
    await clicar(document.querySelector("[data-shell-logout-confirm]"));

    expect(encerrar).toHaveBeenCalledTimes(1);
    expect(dialogo().hidden).toBe(true);
    expect(saindo().hidden).toBe(false);
    expect(document.getElementById("topUserMenu").hasAttribute("open")).toBe(
      false,
    );

    // Um Sair por vez: outro pedido enquanto sai não abre o diálogo.
    await expect(sairDoSistema({ encerrar })).resolves.toBe(false);
    expect(dialogo().hidden).toBe(true);

    await act(async () => terminar());
    await expect(resultado).resolves.toBe(true);
    expect(saindo().hidden).toBe(true);
  });

  it("com o diálogo aberto, um segundo pedido não abre outro", async () => {
    const primeiro = await pedirSaida();
    await expect(sairDoSistema()).resolves.toBe(false);
    expect(document.querySelectorAll("#shellLogoutDialog")).toHaveLength(1);
    await clicar(document.querySelector(".shell-confirm-cancel"));
    await expect(primeiro.resultado).resolves.toBe(false);
  });

  it("falha ao encerrar avisa e some com o 'Saindo'", async () => {
    window.monitoraToast = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const encerrar = vi.fn(() => Promise.reject(new Error("rede")));
    const { resultado } = await pedirSaida(encerrar);
    await clicar(document.querySelector("[data-shell-logout-confirm]"));
    await expect(resultado).resolves.toBe(false);
    expect(window.monitoraToast).toHaveBeenCalledWith(
      "Não foi possível encerrar esta sessão. Tente novamente.",
      "error",
    );
    expect(saindo().hidden).toBe(true);
    expect(obterSaida().saindo).toBe(false);
  });

  /*
    O aviso de "alterações não salvas" do Sair procurava um indicador que não
    existe mais (#configWorkspaceDirtyTop) e nunca aparecia. Agora pergunta ao
    estado das Configurações, o mesmo que o navigate consulta.
  */
  it("o aviso do Sair segue as alterações não salvas das Configurações", () => {
    const estado = criarEstadoDasConfiguracoes({ supabase: () => null });
    estado.definirValoresCarregados({ page_title: "Saúde Indígena" });
    expect(temConfiguracaoNaoSalva(estado)).toBe(false);
    estado.mudarCampo("page_title", "Outro título");
    expect(temConfiguracaoNaoSalva(estado)).toBe(true);
    estado.mudarCampo("page_title", "Saúde Indígena");
    expect(temConfiguracaoNaoSalva(estado)).toBe(false);
    expect(temConfiguracaoNaoSalva(null)).toBe(false);
  });

  it("sem rascunho em Configurações, o aviso fica escondido", async () => {
    await pedirSaida();
    expect(document.getElementById("shellLogoutUnsavedWarning").hidden).toBe(
      true,
    );
  });
});

describe("o seletor de tema do rodapé", () => {
  it("expõe o estado e a próxima ação do tema", () => {
    expect(estadoDoSeletorDeTema(false)).toMatchObject({
      tema: "claro",
      icone: "sun",
      rotulo: "Tema claro ativo. Alternar para tema escuro.",
    });
    expect(estadoDoSeletorDeTema(true)).toMatchObject({
      tema: "escuro",
      icone: "moon",
      rotulo: "Tema escuro ativo. Alternar para tema claro.",
    });
  });

  /*
    O seletor Claro/Escuro mora no rodapé da barra. `toggleDarkMode` inverte o
    tema, então clicar no segmento que já vale não pode chamá-lo.
  */
  it("o seletor de tema tem Claro e Escuro, e o segmento ativo não inverte", () => {
    expect(OPCOES_DE_TEMA.map((opcao) => opcao.rotulo)).toEqual([
      "Claro",
      "Escuro",
    ]);
    expect(deveAlternarTema("escuro", false)).toBe(true);
    expect(deveAlternarTema("claro", true)).toBe(true);
    expect(deveAlternarTema("claro", false)).toBe(false);
    expect(deveAlternarTema("escuro", true)).toBe(false);
  });
});

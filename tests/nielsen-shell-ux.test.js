import { describe, expect, it } from "vitest";
import { criarEstadoDasConfiguracoes } from "../src/modulos/configuracoes/estado.js";
import {
  deveAlternarTema,
  hasUnsavedConfiguration,
  OPCOES_DE_TEMA,
  themeControlState,
} from "../src/modules/nielsen-shell-ux.js";

describe("Nielsen shell UX", () => {
  it("expõe o estado e a próxima ação do tema", () => {
    expect(themeControlState(false)).toMatchObject({
      tema: "claro",
      icon: "sun",
      pressed: "false",
      title: "Tema claro",
    });
    expect(themeControlState(true)).toMatchObject({
      tema: "escuro",
      icon: "moon",
      pressed: "true",
      title: "Tema escuro",
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

  /*
    O aviso de "alterações não salvas" do Sair procurava um indicador que não
    existe mais (#configWorkspaceDirtyTop) e nunca aparecia. Agora pergunta ao
    estado das Configurações, o mesmo que o navigate consulta.
  */
  it("o aviso do Sair segue as alterações não salvas das Configurações", () => {
    const estado = criarEstadoDasConfiguracoes({ supabase: () => null });
    estado.definirValoresCarregados({ page_title: "Saúde Indígena" });
    expect(hasUnsavedConfiguration(estado)).toBe(false);
    estado.mudarCampo("page_title", "Outro título");
    expect(hasUnsavedConfiguration(estado)).toBe(true);
    estado.mudarCampo("page_title", "Saúde Indígena");
    expect(hasUnsavedConfiguration(estado)).toBe(false);
    expect(hasUnsavedConfiguration(null)).toBe(false);
  });
});

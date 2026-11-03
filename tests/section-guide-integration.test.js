import { describe, expect, it } from "vitest";
import { obterPaginaDaAya } from "../src/modulos/aya/estado.ts";
import { criarNavegacao } from "../src/app/navegacao.ts";

/*
  A navegação real (src/app/navegacao.ts) avisa a Aya da página aberta: é daí
  que saem a saudação, as sugestões e o contexto das perguntas. O título vai
  para o store da navegação (o cabeçalho React lê), não para o nome da aba.
*/
describe("título e Aya conectados à navegação real", () => {
  it.each([
    ["dashboard", "Saúde Indígena"],
    ["nucleo", "Editais"],
    ["recursos", "Painel de recursos"],
    ["config", ""],
  ])("avisa a Aya de %s sem renomear a aba", (view, titulo) => {
    document.body.innerHTML = "";
    const navegacao = criarNavegacao({
      janela: {},
      obterPerfil: () => ({ id: "a", ativo: true, perfil: "admin" }),
      configuracao: (chave) => ({ page_title: "Saúde Indígena" })[chave] || "",
      confirmarSaida: () => true,
      aplicarAtualizacao: () => false,
    });
    navegacao.irPara(view);
    expect(document.title).toBe("MONITORA");
    expect(navegacao.obter().titulo).toBe(titulo);
    expect(obterPaginaDaAya()).toMatchObject({ view, titulo });
    navegacao.desligar();
  });
});

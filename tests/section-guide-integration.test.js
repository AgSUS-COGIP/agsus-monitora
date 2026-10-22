import { describe, expect, it } from "vitest";
import { obterPaginaDaAya } from "../src/modulos/aya/estado.js";
import { criarNavegacao } from "../src/app/navegacao.js";

/*
  A navegação real (src/app/navegacao.js) avisa a Aya da página aberta: é daí
  que saem a saudação, as sugestões e o contexto das perguntas.
*/
describe("título e Aya conectados à navegação real", () => {
  it.each([
    ["dashboard", "Saúde Indígena"],
    ["nucleo", "Editais"],
    ["recursos", "Recursos"],
    ["config", "Configurações"],
  ])("avisa a Aya de %s sem renomear a aba", (view, title) => {
    document.body.innerHTML = `<h1 id="pageTitle"></h1><p id="pageSubtitle"></p>
      <section id="page-dashboard" class="page"></section>
      <section id="page-${view}" class="page"></section>`;
    const navegacao = criarNavegacao({
      janela: {},
      obterPerfil: () => ({ id: "a", ativo: true, perfil: "admin" }),
      confirmarSaida: () => true,
      aplicarAtualizacao: () => false,
    });
    navegacao.irPara(view);
    navegacao.definirTitulo(title, "Orientações da seção");
    expect(document.title).toBe("MONITORA");
    expect(document.getElementById("pageTitle").textContent).toBe(title);
    expect(obterPaginaDaAya()).toMatchObject({ view, titulo: title });
  });
});

import { describe, expect, it, vi } from "vitest";
import { criarPerfil } from "../../src/app/perfil.js";

/* Quem entrou (src/app/perfil.js): cópia da sessão e o que o app mostra dele. */

function sessaoFalsa() {
  let estado = { usuario: null, perfil: null, painelIds: [] };
  const ouvintes = new Set();
  return {
    obter: () => estado,
    assinar: (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    definir(parcial) {
      estado = { ...estado, ...parcial };
      ouvintes.forEach((ouvinte) => ouvinte());
    },
  };
}

function montarPagina() {
  document.body.className = "access-request-mode";
  document.body.innerHTML = `
    <section id="appScreen" class="app hidden"></section>
    <strong id="userName"></strong><strong id="topUserPopoverName"></strong>
    <small id="userEmail"></small><small id="userProfileBadge"></small>
    <span id="topUserPopoverProfile"></span>`;
}

const ANA = { id: "u1", email: "ana@agenciasus.org.br" };
const GESTOR = {
  id: "p1",
  ativo: true,
  perfil: "edital_gestor",
  nome_completo: "Ana Souza",
  permissoes: { dashboard: "leitor" },
};

describe("perfil", () => {
  it("segue a sessão e avisa só quando o perfil muda", () => {
    const sessao = sessaoFalsa();
    const perfil = criarPerfil({ sessao });
    const ouvinte = vi.fn();
    perfil.aoMudarPerfil(ouvinte);
    perfil.acompanharSessao();
    sessao.definir({ usuario: ANA, perfil: GESTOR, painelIds: ["7"] });
    expect(perfil.obterUsuario()).toBe(ANA);
    expect(perfil.obterPerfil()).toBe(GESTOR);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(ouvinte.mock.calls[0][0].painelIds).toEqual(["7"]);
    sessao.definir({ usuario: { ...ANA } });
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(perfil.pode("ind")).toBe(true);
    expect(perfil.pode("cores")).toBe(false);
  });

  it("mostra quem entrou no cabeçalho, com o rótulo do perfil", () => {
    montarPagina();
    const sessao = sessaoFalsa();
    const perfil = criarPerfil({ sessao });
    perfil.acompanharSessao();
    sessao.definir({ usuario: ANA, perfil: GESTOR });
    perfil.mostrarNaBarra();
    expect(document.getElementById("userEmail").textContent).toBe(ANA.email);
    expect(document.getElementById("userProfileBadge").textContent).toBe(
      "Gestor",
    );
    expect(document.getElementById("topUserPopoverProfile").textContent).toBe(
      "Gestor",
    );
    expect(document.getElementById("userName").textContent).not.toBe("");
  });

  it("abre e esconde o app", () => {
    montarPagina();
    const perfil = criarPerfil({ sessao: sessaoFalsa() });
    perfil.mostrarApp();
    expect(document.getElementById("appScreen").classList).not.toContain(
      "hidden",
    );
    expect(document.body.classList).not.toContain("access-request-mode");
    perfil.esconderApp();
    expect(document.getElementById("appScreen").classList).toContain("hidden");
  });
});

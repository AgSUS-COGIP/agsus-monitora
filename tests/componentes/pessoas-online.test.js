import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarPessoasOnline } from "../../src/componentes/pessoas-online/pessoas-online.jsx";
import { situacaoDaPresenca } from "../../src/lib/online-presence.js";
import { normalizeOnlinePresenceList } from "../../src/lib/online-presence.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  "Pessoas online" no cabeçalho (src/componentes/pessoas-online/): o botão, a
  lista com o rótulo do perfil (não o código) e o "Mensagem" inteiro.
*/

function presencaFalsa(inicial = {}, { perfil, usuario } = {}) {
  let estado = {
    visivel: true,
    aberto: false,
    sincronizado: true,
    desde: Date.now(),
    pessoas: [],
    ...inicial,
  };
  const ouvintes = new Set();
  const definir = (parcial) => {
    estado = { ...estado, ...parcial };
    ouvintes.forEach((ouvinte) => ouvinte());
  };
  return {
    obter: () => estado,
    assinar: (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    alternar: vi.fn(() => definir({ aberto: !estado.aberto })),
    fechar: vi.fn(() => definir({ aberto: false })),
    perfilAtual: () =>
      perfil ?? {
        id: "g",
        ativo: true,
        perfil: "edital_gestor",
        permissoes: { chat: "leitor" },
      },
    usuarioAtual: () => usuario ?? { id: "eu" },
    definir,
  };
}

const PESSOAS = normalizeOnlinePresenceList([
  {
    user_id: "eu",
    full_name: "Yassury Suira",
    profile_label: "Admin",
    current_view: "analises",
  },
  {
    user_id: "u2",
    full_name: "Maria Aparecida dos Santos Nascimento Ferreira",
    profile_label: "Edital_gestor",
    current_view: "Recursos · Saúde Indígena",
  },
  { user_id: "u3", full_name: "Caio", profile_label: "Master" },
]);

let montado = null;
async function montar(presenca) {
  document.body.innerHTML = `<div class="actions"><div id="pessoasOnlineApp"></div></div>`;
  await act(async () => {
    montado = montarPessoasOnline({ presenca });
  });
  return presenca;
}

const $ = (id) => document.getElementById(id);

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => true,
  });
});
afterEach(() => {
  act(() => montado?.desmontar());
  montado = null;
  vi.useRealTimers();
});

describe("botão", () => {
  it("mostra a contagem e abre a lista", async () => {
    const presenca = await montar(presencaFalsa({ pessoas: PESSOAS }));
    expect($("onlinePresenceLabel").textContent).toBe("3 online");
    expect($("onlinePresence").dataset.presenceState).toBe("ready");
    expect($("onlinePresenceBtn").getAttribute("aria-label")).toBe(
      "3 pessoas online. Ver lista.",
    );
    expect($("onlinePresencePopover").hidden).toBe(true);
    await act(async () => $("onlinePresenceBtn").click());
    expect(presenca.alternar).toHaveBeenCalled();
    expect($("onlinePresencePopover").hidden).toBe(false);
    expect($("onlinePresenceBtn").getAttribute("aria-expanded")).toBe("true");
  });

  it("escondido quando o perfil não vê (estado.visivel = false)", async () => {
    await montar(presencaFalsa({ visivel: false }));
    expect($("onlinePresence").classList.contains("hidden")).toBe(true);
  });

  it("Sincronizando vira Presença indisponível depois da espera", async () => {
    vi.useFakeTimers();
    await montar(
      presencaFalsa({ sincronizado: false, desde: Date.now(), aberto: true }),
    );
    expect($("onlinePresenceLabel").textContent).toBe("Sincronizando");
    expect($("onlinePresenceList").textContent).toBe("Sincronizando presença…");
    await act(async () => vi.advanceTimersByTime(13_000));
    expect($("onlinePresenceLabel").textContent).toBe("Presença indisponível");
    expect($("onlinePresence").dataset.presenceState).toBe("error");
    expect($("onlinePresenceList").textContent).toBe(
      "Não foi possível atualizar a presença agora.",
    );
  });

  it("sem internet: Offline", async () => {
    await montar(presencaFalsa({ pessoas: PESSOAS }));
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    await act(async () => window.dispatchEvent(new Event("offline")));
    expect($("onlinePresenceLabel").textContent).toBe("Offline");
    expect($("onlinePresence").dataset.presenceState).toBe("offline");
  });

  it("Esc fecha a lista", async () => {
    const presenca = await montar(presencaFalsa({ aberto: true }));
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(presenca.fechar).toHaveBeenCalled();
  });
});

describe("lista", () => {
  it("mostra o rótulo do perfil, não o código do banco", async () => {
    await montar(presencaFalsa({ pessoas: PESSOAS, aberto: true }));
    const linhas = [...document.querySelectorAll(".online-presence-person")];
    const perfis = linhas.map(
      (linha) => linha.querySelector("small").textContent,
    );
    expect(perfis).toEqual([
      "Administrador global",
      "Gestor · Recursos · Saúde Indígena",
      "Administrador global · Análises curriculares",
    ]);
    const texto = $("onlinePresenceList").textContent;
    expect(texto).not.toMatch(/Edital_gestor|\bAdmin\b|Master/);
  });

  it("Mensagem: para as outras pessoas, inteiro, ao lado do texto que encolhe", async () => {
    await montar(presencaFalsa({ pessoas: PESSOAS, aberto: true }));
    const botoes = [...document.querySelectorAll("[data-chat-usuario]")];
    expect(botoes.map((b) => b.getAttribute("data-chat-usuario"))).toEqual([
      "u3",
      "u2",
    ]);
    for (const botao of botoes) {
      expect(botao.textContent).toBe("Mensagem");
      // O texto da pessoa e o botão são irmãos: o texto encolhe, o botão não.
      expect(botao.previousElementSibling.className).toBe(
        "online-presence-texto",
      );
    }
    expect(botoes[1].getAttribute("aria-label")).toBe(
      "Mensagem para Maria Aparecida dos Santos Nascimento Ferreira",
    );
    // Regras que mantêm o botão inteiro e a lista sem rolagem lateral.
    const shell = readFileSync("src/styles/platform-shell.css", "utf8");
    expect(shell).toMatch(
      /\.online-presence-texto \{\s*flex: 1 1 auto;\s*min-width: 0;/,
    );
    expect(shell).toMatch(/\.online-presence-list \{[^}]*overflow-x: hidden;/);
    // No celular, a lista abre de borda a borda do cabeçalho (não sai da tela).
    expect(shell).toMatch(
      /@media \(max-width: 900px\) \{\s*\.online-presence \{\s*position: static;\s*\}\s*\.online-presence-popover \{\s*left: 0;\s*right: 0;\s*width: auto;/,
    );
    const chat = readFileSync("src/modulos/chat/chat.css", "utf8");
    expect(chat).toMatch(
      /\.online-presence-mensagem \{\s*flex: none;\s*white-space: nowrap;/,
    );
  });

  it("sem chat no perfil, sem Mensagem", async () => {
    await montar(
      presencaFalsa(
        { pessoas: PESSOAS, aberto: true },
        { perfil: { id: "c", ativo: true, perfil: "usuario" } },
      ),
    );
    expect(document.querySelector("[data-chat-usuario]")).toBeNull();
  });

  it("ninguém mais: o aviso curto", async () => {
    await montar(presencaFalsa({ aberto: true }));
    expect($("onlinePresenceList").textContent).toBe(
      "Ninguém mais com a plataforma aberta agora.",
    );
  });
});

describe("situacaoDaPresenca", () => {
  it("pronta, carregando, indisponível e offline", () => {
    expect(situacaoDaPresenca({ sincronizado: true, quantos: 1 })).toEqual({
      estado: "ready",
      rotulo: "1 online",
      detalhe: "1 pessoa online.",
    });
    expect(situacaoDaPresenca({ esperaMs: 2_000 }).estado).toBe("loading");
    expect(situacaoDaPresenca({ esperaMs: 15_000 }).rotulo).toBe(
      "Presença indisponível",
    );
    expect(situacaoDaPresenca({ online: false }).rotulo).toBe("Offline");
  });
});

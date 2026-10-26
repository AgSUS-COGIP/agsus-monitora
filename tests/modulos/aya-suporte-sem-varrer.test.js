import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { clicar, digitar } from "../componentes/interacoes.js";

/*
  22/10: o link "Feedback e suporte" do topo da Aya varria o DOM da página
  (collectAyaPageContext) a cada render, ou seja, a cada tecla no campo.
  Agora varre quando a conversa ou a página mudam e de novo no clique.
*/

const varrer = vi.hoisted(() => ({ vezes: 0 }));
vi.mock("../../src/modulos/aya/contexto.ts", async (original) => {
  const real = await original();
  return {
    ...real,
    collectAyaPageContext: (...args) => {
      varrer.vezes += 1;
      return real.collectAyaPageContext(...args);
    },
  };
});

const { montarAya } = await import("../../src/modulos/aya/aya.tsx");
const { definirPaginaDaAya, redefinirPaginaDaAya } =
  await import("../../src/modulos/aya/estado.ts");

let raiz;
let controlador;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  redefinirDadosDoMonitoramento();
  definirAreasDoUsuario(["sede"]);
  definirAreaAtual("sede");
  redefinirPaginaDaAya();
  definirPaginaDaAya("recursos", "Painel de recursos");
});
afterEach(async () => {
  await act(async () => controlador?.desmontar());
  raiz?.remove();
});

describe("Aya: suporte sem varrer a página a cada tecla", () => {
  it("digitar não varre; o clique no suporte varre e atualiza o link", async () => {
    raiz = document.createElement("div");
    document.body.append(raiz);
    await act(async () => {
      controlador = montarAya({
        elemento: raiz,
        perguntar: vi.fn(),
        navegar: vi.fn(),
        abrirSecao: vi.fn(),
        configuracao: (chave) =>
          chave === "support_email" ? "suporte@agenciasus.org.br" : "",
      });
    });
    await clicar(raiz.querySelector(".aya-arara"));
    const campo = raiz.querySelector("textarea");
    const antes = varrer.vezes;
    await digitar(campo, "c");
    await digitar(campo, "co");
    await digitar(campo, "com");
    expect(varrer.vezes).toBe(antes);

    const suporte = raiz.querySelector(".aya-painel__acoes .aya-suporte");
    suporte.addEventListener("click", (e) => e.preventDefault());
    await clicar(suporte);
    expect(varrer.vezes).toBe(antes + 1);
    expect(suporte.getAttribute("href")).toContain("suporte");
  });
});

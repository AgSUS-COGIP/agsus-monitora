import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENTO_EDITAL_CONCLUIDO } from "../../src/lib/encerramento-do-edital.ts";
import { EncerramentoDoEdital } from "../../src/modulos/encerramento-do-edital/encerramento-do-edital.tsx";
import { criarEstadoDoEncerramento } from "../../src/modulos/encerramento-do-edital/estado.ts";
import {
  MarcaDeSeloNoAvatar,
  SelosDoEdital,
} from "../../src/modulos/encerramento-do-edital/selos-do-edital.tsx";
import { clicar } from "../componentes/interacoes.js";

/*
  Tela de encerramento do edital: abre uma vez (o visto vai ao banco), com os
  totais e só a parte de quem vê; fogos do catálogo uma vez, nenhum para quem
  já viu o edital zerar, os próprios para quem fechou. Selos no perfil. Sem
  edital encerrado (ou sem a RPC), nada aparece.
*/

const edital = (parte = {}) => ({
  id: "e114",
  edital: "114/2026",
  numero: "114/2026",
  area: "projetos",
  concluido_em: "2026-10-22T18:00:00Z",
  inscritos: 7726,
  fichas: 1512,
  dias: 9,
  visto: false,
  minha: {
    fichas: 50,
    percentual: 3.3,
    melhor_dia: { dia: "2026-10-21", qt: 20 },
    fechou: false,
  },
  ...parte,
});

/* O banco de mentira: depois do visto, a leitura já diz visto. */
function clienteFalso(resposta) {
  const chamadas = [];
  const vistos = new Set();
  return {
    chamadas,
    rpc: vi.fn(async (nome, argumentos) => {
      chamadas.push([nome, argumentos]);
      if (nome === "marcar_encerramento_visto") {
        vistos.add(argumentos.p_edital);
        return { data: true, error: null };
      }
      const editais = resposta.data?.editais;
      return Array.isArray(editais)
        ? {
            ...resposta,
            data: {
              editais: editais.map((e) =>
                vistos.has(e.id) ? { ...e, visto: true } : e,
              ),
            },
          }
        : resposta;
    }),
  };
}

let raizes = [];
const hosts = [];

async function montar(componente) {
  const host = document.createElement("div");
  document.body.append(host);
  hosts.push(host);
  const raiz = createRoot(host);
  raizes.push(raiz);
  await act(async () => {
    raiz.render(createElement(StrictMode, null, componente));
  });
  return host;
}

afterEach(() => {
  act(() => raizes.forEach((r) => r.unmount()));
  hosts.splice(0).forEach((h) => h.remove());
  raizes = [];
});

const tela = () => document.querySelector(".encerramento");

describe("tela de encerramento", () => {
  it("sem edital encerrado, ou sem a RPC no banco, nada aparece", async () => {
    for (const resposta of [
      { data: { editais: [] }, error: null },
      { data: null, error: { code: "PGRST202" } },
    ]) {
      const cliente = clienteFalso(resposta);
      const estado = criarEstadoDoEncerramento({
        cliente: () => cliente,
        ligadas: () => true,
      });
      const comemorar = vi.fn();
      await montar(createElement(EncerramentoDoEdital, { estado, comemorar }));
      await act(() => estado.verificar());
      expect(tela()).toBeNull();
      expect(comemorar).not.toHaveBeenCalled();
    }
  });

  it("abre uma vez com totais e só a parte de quem vê; fechar grava o visto", async () => {
    const cliente = clienteFalso({
      data: { editais: [edital()] },
      error: null,
    });
    const estado = criarEstadoDoEncerramento({
      cliente: () => cliente,
      ligadas: () => true,
    });
    const comemorar = vi.fn();
    await montar(createElement(EncerramentoDoEdital, { estado, comemorar }));
    await act(() => estado.verificar());

    const t = tela();
    expect(t.querySelector("h2").textContent).toBe("Edital 114/2026 concluído");
    const kpis = [...t.querySelectorAll(".ui-kpi")].map((k) => k.textContent);
    expect(kpis).toEqual([
      "Inscritos7.726",
      "Fichas analisadas1.512",
      "Dias de análise9",
    ]);
    expect(t.textContent).toContain("Obrigado, equipe.");
    const minha = [...t.querySelectorAll(".encerramento-minha dd")].map(
      (d) => d.textContent,
    );
    expect(minha).toEqual(["50", "3,3%", "21/10 · 20 fichas"]);
    expect(t.querySelector(".encerramento-fechou")).toBeNull();
    // Fogos do marco, uma vez (mesmo com o StrictMode).
    expect(comemorar).toHaveBeenCalledTimes(1);
    expect(comemorar).toHaveBeenCalledWith({
      marco: "edital-concluido",
      forma: "coracao",
      texto: "Edital 114/2026 concluído! Obrigado, equipe.",
    });

    await act(async () => clicar(t.querySelector(".encerramento-acoes .btn")));
    expect(tela()).toBeNull();
    expect(cliente.chamadas).toContainEqual([
      "marcar_encerramento_visto",
      { p_edital: "e114" },
    ]);
    // Visto: não abre de novo.
    await act(() => estado.verificar());
    expect(estado.obter().aberto).toBeNull();
  });

  it("já visto (outro navegador, dia seguinte): não abre", async () => {
    const cliente = clienteFalso({
      data: { editais: [edital({ visto: true })] },
      error: null,
    });
    const estado = criarEstadoDoEncerramento({
      cliente: () => cliente,
      ligadas: () => true,
    });
    await montar(
      createElement(EncerramentoDoEdital, { estado, comemorar: vi.fn() }),
    );
    await act(() => estado.verificar());
    expect(tela()).toBeNull();
    expect(estado.obter().encerramentos).toHaveLength(1);
  });

  it("comemorações desligadas no sistema: não abre nem marca", async () => {
    const cliente = clienteFalso({
      data: { editais: [edital()] },
      error: null,
    });
    const estado = criarEstadoDoEncerramento({
      cliente: () => cliente,
      ligadas: () => false,
    });
    await montar(
      createElement(EncerramentoDoEdital, { estado, comemorar: vi.fn() }),
    );
    await act(() => estado.verificar());
    expect(tela()).toBeNull();
    expect(cliente.chamadas.map((c) => c[0])).toEqual([
      "obter_encerramentos_do_edital",
    ]);
  });

  it("quem viu o edital zerar na tela de Análises não ganha os fogos de novo", async () => {
    const cliente = clienteFalso({
      data: { editais: [edital()] },
      error: null,
    });
    const estado = criarEstadoDoEncerramento({
      cliente: () => cliente,
      ligadas: () => true,
    });
    const desligar = estado.acompanhar(window);
    const comemorar = vi.fn();
    await montar(createElement(EncerramentoDoEdital, { estado, comemorar }));
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(EVENTO_EDITAL_CONCLUIDO, {
          detail: { editais: ["114/2026"] },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(tela()).not.toBeNull();
    expect(comemorar).not.toHaveBeenCalled();
    desligar();
  });

  it("quem fechou: título e animação própria", async () => {
    const cliente = clienteFalso({
      data: {
        editais: [
          edital({ minha: { fichas: 2, percentual: 0.1, fechou: true } }),
        ],
      },
      error: null,
    });
    const estado = criarEstadoDoEncerramento({
      cliente: () => cliente,
      ligadas: () => true,
    });
    const comemorar = vi.fn();
    await montar(createElement(EncerramentoDoEdital, { estado, comemorar }));
    await act(() => estado.verificar());
    expect(tela().querySelector(".encerramento-fechou").textContent).toBe(
      "Você fechou o 114",
    );
    expect(comemorar).toHaveBeenCalledWith(
      expect.objectContaining({ marco: "edital-fechado", forma: "estrela" }),
    );
  });
});

describe("selos do edital", () => {
  it("um selo por edital encerrado; quem fechou leva o título; marca no avatar", async () => {
    const cliente = clienteFalso({
      data: {
        editais: [
          edital({ visto: true }),
          edital({
            id: "e93",
            numero: "93/2026",
            concluido_em: "2026-11-01",
            visto: true,
            minha: { fichas: 1, fechou: true },
          }),
        ],
      },
      error: null,
    });
    const estado = criarEstadoDoEncerramento({ cliente: () => cliente });
    const lista = await montar(createElement(SelosDoEdital, { estado }));
    const avatar = await montar(createElement(MarcaDeSeloNoAvatar, { estado }));
    expect(lista.textContent).toBe("");
    expect(avatar.textContent).toBe("");
    await act(() => estado.verificar());
    expect(
      [...lista.querySelectorAll(".selo-do-edital")].map((s) => s.textContent),
    ).toEqual(["114/2026", "93/2026fechou o 93"]);
    expect(
      avatar.querySelector(".selo-no-avatar-marca").getAttribute("aria-label"),
    ).toBe("Você fechou o edital 93");
    // Saiu da sessão: nada fica.
    act(() => estado.esquecer());
    expect(lista.querySelector(".selo-do-edital")).toBeNull();
  });
});

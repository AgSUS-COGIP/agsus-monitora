import { describe, expect, it, vi } from "vitest";
import { telaSobDemanda } from "../src/app/tela-sob-demanda.js";
import {
  haTelaCarregando,
  preCarregarTela,
  registrarPreCarga,
} from "../src/lib/carga-de-telas.js";

/*
  As telas fora da abertura carregam sob demanda: o controlador em window
  mantém o contrato (render, abrirVisao…), mostra "Carregando…" na seção e
  só baixa uma vez.
*/
describe("tela sob demanda", () => {
  it("render antes da carga baixa, monta uma vez e chama o de verdade", async () => {
    document.body.innerHTML = `<section id="page-x"></section>`;
    const render = vi.fn(() => "pronto");
    let soltar;
    const carregar = vi.fn(
      () =>
        new Promise((r) => {
          soltar = () => r({ render, estado: { nome: "real" } });
        }),
    );
    const tela = telaSobDemanda({ carregar, secao: "page-x" });
    expect(tela.carregado).toBe(false);
    expect(tela.estado).toBeUndefined();
    const primeira = tela.render("a");
    const segunda = tela.render("b");
    expect(document.getElementById("page-x").textContent).toBe("Carregando…");
    expect(haTelaCarregando()).toBe(true);
    soltar();
    expect(await primeira).toBe("pronto");
    await segunda;
    expect(carregar).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith("a");
    expect(render).toHaveBeenCalledWith("b");
    expect(haTelaCarregando()).toBe(false);
    expect(tela.carregado).toBe(true);
    expect(tela.estado).toEqual({ nome: "real" });
  });

  it("padroes respondem antes da carga; método fora da lista é undefined", () => {
    const tela = telaSobDemanda({
      carregar: () => Promise.resolve({}),
      padroes: { confirmarSaida: () => true },
    });
    expect(tela.confirmarSaida()).toBe(true);
    expect(tela.openImportModal).toBeUndefined();
    expect(tela.then).toBeUndefined();
  });

  it("falha de rede deixa tentar de novo", async () => {
    const carregar = vi
      .fn()
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce({ render: () => 1 });
    const tela = telaSobDemanda({ carregar });
    await expect(tela.render()).rejects.toThrow("rede");
    expect(await tela.render()).toBe(1);
  });

  it("a pré-carga do menu chama quem foi registrado", () => {
    const funcao = vi.fn();
    preCarregarTela("recursos");
    registrarPreCarga(funcao);
    preCarregarTela("config", "acessos");
    expect(funcao).toHaveBeenCalledWith("config", "acessos");
    registrarPreCarga(null);
  });
});

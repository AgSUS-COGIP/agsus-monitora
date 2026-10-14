import { describe, expect, it, vi } from "vitest";
import { criarEstadoDaCarta } from "../../src/modulos/aprovados/carta-de-convocacao/estado.ts";
import { lerModelosDoBanco } from "../../src/lib/carta-de-convocacao.ts";

const modelo = () =>
  lerModelosDoBanco({
    modelos: [
      {
        modelo_id: "m1",
        nome: "Carta",
        vigente: { titulo: "Carta", texto: "Olá {NOME}" },
      },
    ],
  }).modelos[0];
describe("confirmação e dados da carta", () => {
  it("histórico malformado libera a carga e permite tentar novamente", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { cartas: [null] }, error: null })
      .mockResolvedValueOnce({
        data: { cartas: [{ carta_id: "c1" }] },
        error: null,
      });
    const estado = criarEstadoDaCarta({ supabase: { rpc } });
    await estado.carregarHistorico("a1");
    expect(estado.obter().historicos.get("a1")).toMatchObject({
      carregando: false,
      cartas: [],
      erro: expect.stringMatching(/Dados da carta inválidos/),
    });
    await estado.carregarHistorico("a1");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(estado.obter().historicos.get("a1")).toMatchObject({
      carregando: false,
      erro: "",
      cartas: [{ carta_id: "c1" }],
    });
  });
  it("confirmação incompleta bloqueia a saída e não repete o registro", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const imprimir = vi.fn(),
      toast = vi.fn();
    const estado = criarEstadoDaCarta({
      supabase: { rpc },
      perfil: () => ({ role: "admin" }),
      areaAtual: () => "saude-indigena",
      imprimir,
      toast,
    });
    const pedido = {
      modelo: modelo(),
      candidatos: [{ candidato_id: "a1", nome: "Ana" }],
      emissao: {},
      saida: "PDF",
    };
    expect(await estado.emitir(pedido)).toBeNull();
    expect(await estado.emitir(pedido)).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(imprimir).not.toHaveBeenCalled();
    expect(toast.mock.calls[0][0]).toMatch(/confirmação está incompleta/);
    expect(estado.obter().acao).toBeNull();
  });
  it("coleção malformada mostra erro e libera o carregamento", async () => {
    const estado = criarEstadoDaCarta({
      supabase: {
        rpc: async () => ({ data: { modelos: [null] }, error: null }),
      },
      areaAtual: () => "saude-indigena",
    });
    expect(await estado.carregarModelos()).toBe(false);
    expect(estado.obter()).toMatchObject({
      carregando: false,
      carregado: false,
      modelos: [],
    });
    expect(estado.obter().erro).toMatch(/Dados da carta inválidos/);
  });
});

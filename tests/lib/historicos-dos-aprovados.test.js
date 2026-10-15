import { describe, expect, it, vi } from "vitest";
import { cartasDoHistorico } from "../../src/lib/dados-da-carta.ts";
import { publicacaoDoEdital } from "../../src/lib/dados-do-historico-de-publicacoes.ts";
import { criarEstadoDaCarta } from "../../src/modulos/aprovados/carta-de-convocacao/estado.ts";

describe("Históricos de Aprovados", () => {
  it("preserva ordem, nomes e campos adicionais das cartas e publicações", () => {
    const cartas = [
      { carta_id: "b", modelo: "Segunda", candidatos: 2, extra: true },
      { carta_id: "a", modelo: "Primeira", versao: "1" },
    ];
    expect(cartasDoHistorico(cartas)).toEqual([
      expect.objectContaining(cartas[0]),
      expect.objectContaining(cartas[1]),
    ]);
    const dados = publicacaoDoEdital({
      resultado_final: { gerada_em: "2026-10-15", extra: true },
      tem_analises: true,
      publicacoes: [
        {
          id: "b",
          candidatos: 2,
          pendencias: [{ nome: "Ana", motivo: "Saiu" }],
        },
        { id: "a", pendencias: [] },
      ],
    });
    expect(dados.publicacoes.map((p) => p.id)).toEqual(["b", "a"]);
    expect(dados.publicacoes[0].pendencias[0]).toEqual({
      nome: "Ana",
      motivo: "Saiu",
    });
    expect(dados.resultado_final.extra).toBe(true);
  });
  it.each([
    {},
    [null],
    [{ carta_id: "a", modelo: {} }],
    [{ carta_id: "a" }, { modelo: "Sem ID" }],
  ])("não exibe um histórico parcial de cartas: %j", (dados) => {
    expect(() => cartasDoHistorico(dados)).toThrow(/inválid/);
  });
  it.each([
    { publicacoes: {} },
    { publicacoes: [{ id: "a" }, {}] },
    { resultado_final: [] },
    { publicacoes: [{ id: "a", pendencias: [null] }] },
    { publicacoes: [{ id: "a", por: { nome: "Ana" } }] },
  ])(
    "recusa publicações inválidas antes de chegar à interface: %j",
    (dados) => {
      expect(() => publicacaoDoEdital(dados)).toThrow(/inválid/);
    },
  );
  it("aceita histórico vazio e campos opcionais nulos", () => {
    expect(cartasDoHistorico(null)).toEqual([]);
    expect(publicacaoDoEdital(null)).toBeNull();
    expect(
      publicacaoDoEdital({
        resultado_final: null,
        tem_analises: false,
        publicacoes: [],
      }),
    ).toMatchObject({ resultado_final: null, publicacoes: [] });
  });
  it("libera o carregamento após rejeição da RPC e permite tentar de novo", async () => {
    const rpc = vi
      .fn()
      .mockRejectedValueOnce(new Error("Sem rede"))
      .mockResolvedValue({
        data: { cartas: [{ carta_id: "c1", modelo: "Carta padrão" }] },
        error: null,
      });
    const estado = criarEstadoDaCarta({ supabase: { rpc } });
    await estado.carregarHistorico("ana");
    expect(estado.obter().historicos.get("ana")).toMatchObject({
      carregando: false,
      erro: "Sem rede",
      cartas: [],
    });
    await estado.carregarHistorico("ana", { forcar: true });
    expect(estado.obter().historicos.get("ana")).toMatchObject({
      carregando: false,
      erro: "",
      cartas: [expect.objectContaining({ carta_id: "c1" })],
    });
  });
  it("cargas concorrentes mantêm os históricos de ambas as pessoas", async () => {
    let responderAna;
    const rpc = vi.fn((_nome, argumentos) =>
      argumentos.p_candidato === "ana"
        ? new Promise((resolve) => {
            responderAna = resolve;
          })
        : Promise.resolve({
            data: { cartas: [{ carta_id: "bia" }] },
            error: null,
          }),
    );
    const estado = criarEstadoDaCarta({ supabase: { rpc } });
    const ana = estado.carregarHistorico("ana");
    await estado.carregarHistorico("bia");
    responderAna({ data: { cartas: [{ carta_id: "ana" }] }, error: null });
    await ana;
    expect(estado.obter().historicos.get("ana").cartas[0].carta_id).toBe("ana");
    expect(estado.obter().historicos.get("bia").cartas[0].carta_id).toBe("bia");
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  lerModelosDoBanco,
  lerConfiguracoesDoBanco,
} from "../../src/lib/configuracao-de-convocacao.ts";
import { criarEstadoDaListaDeAprovados } from "../../src/modulos/aprovados/estado.ts";
describe("dados da configuração de convocação", () => {
  it.each([
    {},
    [null],
    [{ nome: "Sem identidade" }],
    [{ modelo_id: "m1", categorias: [null] }],
    [{ modelo_id: "m1" }, { modelo_id: "m1" }],
  ])(
    "recusa modelos malformados sem aproveitar só parte da resposta: %j",
    (dados) => {
      expect(() => lerModelosDoBanco(dados)).toThrow(
        /Configuração de convocação inválida/,
      );
    },
  );
  it.each([
    {},
    [null],
    [{ edital_id: "e1", vagas: [null] }],
    [{ edital_id: "e1", vagas: [{ codigo_vaga: "v1", quadro: [] }] }],
    [{ edital_id: "e1" }, { edital_id: "e1" }],
    [
      {
        edital_id: "e1",
        vagas: [{ codigo_vaga: "v1" }, { codigo_vaga: "v1" }],
      },
    ],
  ])("recusa configurações malformadas e chaves duplicadas: %j", (dados) => {
    expect(() => lerConfiguracoesDoBanco(dados)).toThrow(
      /Configuração de convocação inválida/,
    );
  });
  it("mantém mapas vazios para respostas ausentes e aceita listas sem reservas nem vagas", () => {
    expect(lerModelosDoBanco(null).size).toBe(0);
    expect(lerConfiguracoesDoBanco(undefined).size).toBe(0);
    expect(
      lerModelosDoBanco([{ modelo_id: "m1", categorias: [] }]).get("m1")
        .categorias,
    ).toHaveLength(1);
    expect(
      lerConfiguracoesDoBanco([{ edital_id: "e1", vagas: [] }]).get("e1").vagas
        .size,
    ).toBe(0);
  });
  it("uma atualização malformada preserva a configuração anterior e a nova tentativa pode atualizá-la", async () => {
    let modelos = [{ modelo_id: "m1", nome: "Original" }],
      configs = [{ edital_id: "e1", modelo_id: "m1", padrao_imediata: 2 }];
    const toast = vi.fn();
    const rpc = vi.fn(async (nome) => ({
      data: nome === "listar_modelos_convocacao" ? modelos : configs,
      error: null,
    }));
    const estado = criarEstadoDaListaDeAprovados({ supabase: { rpc }, toast });
    await estado.carregarConfiguracoes();
    const anterior = estado.obter();
    modelos = [{ modelo_id: "m2", nome: "Novo" }];
    configs = [{ edital_id: "e1", vagas: [null] }];
    await estado.carregarConfiguracoes();
    expect(estado.obter().modelos).toBe(anterior.modelos);
    expect(estado.obter().configs).toBe(anterior.configs);
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/Configuração de convocação inválida/),
      "warn",
    );
    configs = [{ edital_id: "e1", modelo_id: "m2", padrao_imediata: 3 }];
    await estado.carregarConfiguracoes();
    expect(estado.obter().modelos.has("m2")).toBe(true);
    expect(estado.obter().configs.get("e1").padraoImediata).toBe(3);
  });
});

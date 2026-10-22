import { describe, expect, it, vi } from "vitest";
import {
  linhasDoPayload,
  detalheDaAnalise,
  normalizarPayloadDasAnalises,
} from "../src/lib/analises-curriculares.ts";
import { criarConsultasDasAnalises } from "../src/modulos/analises/consultas.ts";

describe("dados externos de Análises curriculares", () => {
  it.each([
    null,
    [],
    { columns: [10], rows: [[]] },
    { columns: ["__proto__"], rows: [[{}]] },
    { columns: ["constructor"], rows: [[{}]] },
    { columns: ["id"], rows: [{ id: "a1" }] },
  ])("rejeita um envelope inválido antes de decodificar: %j", (payload) => {
    expect(() => normalizarPayloadDasAnalises(payload)).toThrow(/inválido/);
  });

  it("mantém valores escalares e trata objetos e arrays como células vazias", () => {
    const [linha] = linhasDoPayload({
      columns: ["id", "candidato", "nota", "analise"],
      rows: [["a1", { nome: "Pessoa" }, 0, ["parecer"]]],
    });
    expect(linha).toMatchObject({
      id: "a1",
      candidato: null,
      nota: 0,
      analise: null,
    });
    expect(
      detalheDaAnalise({ candidato: { nome: "Pessoa" } }, "sede").titulo,
    ).toBe("Registro da análise");
  });

  it("uma resposta inesperada do porteiro deixa a decisão para a consulta da lista", async () => {
    const supabase = {
      rpc: vi.fn(async () => ({ data: { permitido: true }, error: null })),
    };
    expect(await criarConsultasDasAnalises({ supabase }).podeLer()).toBeNull();
  });

  it("não guarda uma resposta de lista com colunas inválidas", async () => {
    const armazenamento = {
      ler: vi.fn(async () => null),
      guardar: vi.fn(async () => {}),
      apagarTudo: vi.fn(async () => {}),
    };
    const supabase = {
      rpc: vi.fn(async () => ({
        data: { columns: [42], rows: [[]] },
        error: null,
      })),
    };
    const consultas = criarConsultasDasAnalises({
      supabase,
      armazenamento,
      versao: "teste",
    });
    await expect(
      consultas.carregarEscopo({
        area: "sede",
        escopo: "ativo",
        usuarioId: "u1",
      }),
    ).rejects.toThrow(/inválido/);
    expect(armazenamento.guardar).not.toHaveBeenCalled();
  });

  it("descarta uma cópia malformada e recupera a lista do servidor", async () => {
    const memoria = new Map();
    const armazenamento = {
      ler: async (chave) => memoria.get(chave) ?? null,
      guardar: async (chave, valor) => void memoria.set(chave, valor),
      apagarTudo: vi.fn(async () => memoria.clear()),
    };
    const pacote = (id) => ({
      schema_version: 4,
      columns: ["id"],
      rows: [[id]],
    });
    const supabase = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: pacote("a1"), error: null })
        .mockResolvedValueOnce({ data: pacote("a2"), error: null }),
    };
    const consultas = criarConsultasDasAnalises({
      supabase,
      armazenamento,
      versao: "teste",
    });
    const opcoes = { area: "sede", escopo: "ativo", usuarioId: "u1" };
    await consultas.carregarEscopo(opcoes);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const registro = [...memoria.values()].find((valor) => valor?.texto);
    expect(registro).toBeDefined();
    registro.texto = JSON.stringify({
      schema_version: 4,
      columns: [42],
      rows: [[]],
    });
    const resultado = await consultas.carregarEscopo(opcoes);
    expect(resultado.daCopia).toBe(false);
    expect(resultado.linhas[0].id).toBe("a2");
    expect(armazenamento.apagarTudo).toHaveBeenCalledOnce();
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});

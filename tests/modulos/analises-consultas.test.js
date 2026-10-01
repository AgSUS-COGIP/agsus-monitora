import { describe, expect, it, vi } from "vitest";
import { criarConsultasDasAnalises } from "../../src/modulos/analises/consultas.js";

/*
  As consultas de Análises curriculares (src/modulos/analises/consultas.js):
  a lista por escopo com a cópia do navegador e a revalidação por trás,
  "Todos" com os três pacotes, o detalhamento e os pareceres guardados até o
  "Atualizar". No lugar dos testes do antigo transporte consolidado e dos
  pareceres sob demanda do painel.
*/

const pacote = (escopo, ids, extra = {}) => ({
  schema_version: 4,
  scope: escopo,
  grupo: "Saúde Indígena",
  edital_status: escopo === "inativo" ? "Inativo" : "Ativo",
  columns: [
    "id",
    "unidade",
    "edital",
    "codigo_vaga",
    "candidato",
    "responsavel_analise",
  ],
  rows: ids.map((id) => [id, "DSEI A", "1/2026", "V", `Pessoa ${id}`, "Carla"]),
  editais: [],
  total: ids.length,
  generated_at: `2026-09-30T10:00:0${ids.length}Z`,
  ...extra,
});

function memoria() {
  const mapa = new Map();
  return {
    mapa,
    ler: async (chave) => mapa.get(chave) ?? null,
    guardar: async (chave, valor) => void mapa.set(chave, valor),
    apagarTudo: async () => mapa.clear(),
  };
}

function supabaseCom(responder) {
  return { rpc: vi.fn(async (nome, args) => responder(nome, args)) };
}

const opcoes = { area: "saude-indigena", usuarioId: "u1" };

describe("a lista por escopo e a cópia do navegador", () => {
  it("sem cópia, pede ao servidor e guarda; com cópia, devolve na hora e revalida por trás", async () => {
    const armazenamento = memoria();
    let versao = pacote("ativo", ["a1"]);
    const supabase = supabaseCom(() => ({ data: versao, error: null }));
    const consultas = criarConsultasDasAnalises({
      supabase,
      armazenamento,
      versao: "t",
    });

    const primeira = await consultas.carregarEscopo({
      ...opcoes,
      escopo: "ativo",
    });
    expect(primeira.daCopia).toBe(false);
    expect(primeira.linhas[0]).toMatchObject({
      id: "a1",
      grupo: "Saúde Indígena",
    });
    await new Promise((ok) => setTimeout(ok, 0));
    expect(armazenamento.mapa.size).toBe(2); // o dono e a cópia

    versao = pacote("ativo", ["a1", "a2"]);
    const aoMudar = vi.fn();
    const segunda = await consultas.carregarEscopo({
      ...opcoes,
      escopo: "ativo",
      aoMudar,
    });
    expect(segunda.daCopia).toBe(true);
    expect(segunda.linhas).toHaveLength(1);
    await segunda.revalidacao;
    expect(aoMudar).toHaveBeenCalledTimes(1);
    expect(aoMudar.mock.calls[0][0].linhas).toHaveLength(2);
  });

  it("acesso revogado na revalidação: as cópias saem e a tela é avisada", async () => {
    const armazenamento = memoria();
    let erro = null;
    const supabase = supabaseCom(() =>
      erro
        ? { data: null, error: erro }
        : { data: pacote("ativo", ["a1"]), error: null },
    );
    const consultas = criarConsultasDasAnalises({
      supabase,
      armazenamento,
      versao: "t",
    });
    await consultas.carregarEscopo({ ...opcoes, escopo: "ativo" });
    await new Promise((ok) => setTimeout(ok, 0));

    erro = { code: "42501", message: "sem acesso" };
    const aoPerderAcesso = vi.fn();
    const comCopia = await consultas.carregarEscopo({
      ...opcoes,
      escopo: "ativo",
      aoPerderAcesso,
    });
    await comCopia.revalidacao;
    expect(aoPerderAcesso).toHaveBeenCalledWith(erro);
    expect(armazenamento.mapa.size).toBe(0);
  });

  it("Todos: os três pacotes, juntos e sem repetir", async () => {
    const supabase = supabaseCom((_, { p_scope }) => ({
      data: {
        ativo: pacote("ativo", ["a1", "a3"]),
        inativo: pacote("inativo", ["a2"]),
        desativadas: pacote("desativadas", ["a3"]),
      }[p_scope],
      error: null,
    }));
    const consultas = criarConsultasDasAnalises({
      supabase,
      armazenamento: memoria(),
      versao: "t",
    });
    const todos = await consultas.carregarEscopo({
      ...opcoes,
      escopo: "todos",
      forcarRede: true,
    });
    expect(supabase.rpc.mock.calls.map(([, a]) => a.p_scope)).toEqual([
      "ativo",
      "inativo",
      "desativadas",
    ]);
    expect(todos.linhas.map((l) => l.id).sort()).toEqual(["a1", "a2", "a3"]);
    expect(todos.payload.scope).toBe("todos");
  });
});

describe("porteiro, detalhamento e pareceres", () => {
  it("porteiro: true/false; sem resposta, null (a lista decide)", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const responde = (data, error = null) =>
      criarConsultasDasAnalises({
        supabase: supabaseCom(() => ({ data, error })),
        armazenamento: memoria(),
      });
    expect(await responde([true]).podeLer()).toBe(true);
    expect(await responde(false).podeLer()).toBe(false);
    expect(await responde(null, { message: "x" }).podeLer()).toBeNull();
    aviso.mockRestore();
  });

  it("detalhamento uma vez por registro; falha não fica guardada", async () => {
    let falhar = true;
    const supabase = supabaseCom((nome, args) =>
      falhar
        ? { data: null, error: { message: "x" } }
        : { data: [{ id: args.p_id, analise: "ok" }], error: null },
    );
    const consultas = criarConsultasDasAnalises({
      supabase,
      armazenamento: memoria(),
    });
    await expect(consultas.detalhe("a1")).rejects.toBeTruthy();
    falhar = false;
    expect(await consultas.detalhe("a1")).toEqual({ id: "a1", analise: "ok" });
    await consultas.detalhe("a1");
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(await consultas.detalhe("")).toBeNull();
  });

  it("pareceres em lote por área e escopo, até o esquecer()", async () => {
    const supabase = supabaseCom(() => ({
      data: { columns: ["id", "analise"], rows: [["a1", "Parecer"]] },
      error: null,
    }));
    const consultas = criarConsultasDasAnalises({
      supabase,
      armazenamento: memoria(),
    });
    const mapa = await consultas.textos("sede", "ativo");
    expect(mapa.get("a1")).toEqual({ analise: "Parecer" });
    expect(supabase.rpc).toHaveBeenCalledWith("get_analises_texto_do_painel", {
      p_scope: "ativo",
      p_area: "sede",
    });
    await consultas.textos("sede", "ativo");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    consultas.esquecer();
    await consultas.textos("sede", "ativo");
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});

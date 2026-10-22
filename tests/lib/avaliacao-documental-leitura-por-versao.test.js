import { describe, expect, it, vi } from "vitest";
import {
  comListasRefeitas,
  criarLeituraPorVersao,
  funcaoAusente,
  linhasDoPacote,
} from "../../src/lib/avaliacao-documental/leitura-por-versao.ts";

/*
  A leitura por versão (supabase/migrations/20261014230000): os objetos
  refeitos das colunas, a revalidação com p_versao e a volta para a RPC de
  sempre quando o banco ainda não tem a nova.
*/

/* O formato de private."FC_COLUNAS_JSON" (colunas em ordem, dicionário por índice). */
const PACOTE = {
  colunas: ["art", "codigo", "decisao", "motivo", "situacao", "vaga"],
  dicionarios: {
    motivo: [null, "Não finalizou o questionário"],
    situacao: ["ELIMINADO", "NO_LOTE"],
    vaga: ["182418", "182444"],
    decisao: [null, { motivo: "Critério CORES", por: "Ana" }],
  },
  linhas: [
    [50, "7016549", 0, 0, 1, 0],
    [0, "1266667", 0, 1, 0, 0],
    [12.5, "7000001", 1, 0, 1, 1],
  ],
};

describe("linhasDoPacote", () => {
  it("refaz os objetos com todas as chaves, nulos incluídos, na ordem das linhas", () => {
    expect(linhasDoPacote(PACOTE)).toEqual([
      {
        art: 50,
        codigo: "7016549",
        decisao: null,
        motivo: null,
        situacao: "NO_LOTE",
        vaga: "182418",
      },
      {
        art: 0,
        codigo: "1266667",
        decisao: null,
        motivo: "Não finalizou o questionário",
        situacao: "ELIMINADO",
        vaga: "182418",
      },
      {
        art: 12.5,
        codigo: "7000001",
        decisao: { motivo: "Critério CORES", por: "Ana" },
        motivo: null,
        situacao: "NO_LOTE",
        vaga: "182444",
      },
    ]);
  });

  it("pacote vazio ou inválido: lista vazia; célula que falta vira nulo", () => {
    expect(linhasDoPacote(null)).toEqual([]);
    expect(linhasDoPacote({ colunas: [], linhas: [] })).toEqual([]);
    expect(linhasDoPacote({ colunas: ["a", "b"], linhas: [[1]] })).toEqual([
      { a: 1, b: null },
    ]);
  });
});

describe("comListasRefeitas", () => {
  it("troca <campo>_em_colunas pelo campo, sem mexer no resto", () => {
    const r = comListasRefeitas({
      versao: "v1",
      vagas: [{ codigo: "182418" }],
      candidatos_em_colunas: PACOTE,
    });
    expect(r).not.toHaveProperty("candidatos_em_colunas");
    expect(r.candidatos).toHaveLength(3);
    expect(r.vagas).toEqual([{ codigo: "182418" }]);
    expect(r.versao).toBe("v1");
  });

  it("payload da RPC de sempre volta como veio", () => {
    const antigo = { candidatos: [{ codigo: "1" }] };
    expect(comListasRefeitas(antigo)).toBe(antigo);
  });
});

describe("funcaoAusente", () => {
  it("PGRST202 (PostgREST) e 42883 (Postgres) são função ausente", () => {
    expect(funcaoAusente({ code: "PGRST202" })).toBe(true);
    expect(funcaoAusente({ code: "42883" })).toBe(true);
    expect(funcaoAusente({ code: "42501" })).toBe(false);
    expect(funcaoAusente(new Error("rede"))).toBe(false);
    expect(funcaoAusente(null)).toBe(false);
  });
});

function banco(respostas) {
  return vi.fn(async (nome, argumentos) => {
    const r = respostas[nome];
    if (r instanceof Error) throw r;
    return typeof r === "function" ? r(argumentos) : (r ?? null);
  });
}

describe("criarLeituraPorVersao", () => {
  const OPCOES = { nova: "obter_x_se_mudou", antiga: "obter_x" };

  it("primeira leitura sem versão; a segunda manda a versão e reaproveita o que tem", async () => {
    const leitura = criarLeituraPorVersao(OPCOES);
    const rpc = banco({
      obter_x_se_mudou: ({ p_versao }) =>
        p_versao === "v1"
          ? { inalterado: true, versao: "v1" }
          : { versao: "v1", candidatos_em_colunas: PACOTE },
    });
    const primeira = await leitura.ler(rpc, { p_edital: "e1" }, "e1");
    expect(rpc).toHaveBeenLastCalledWith("obter_x_se_mudou", {
      p_edital: "e1",
      p_versao: null,
    });
    expect(primeira.candidatos).toHaveLength(3);
    const segunda = await leitura.ler(rpc, { p_edital: "e1" }, "e1");
    expect(rpc).toHaveBeenLastCalledWith("obter_x_se_mudou", {
      p_edital: "e1",
      p_versao: "v1",
    });
    expect(segunda).toBe(primeira);
  });

  it("outra chave (outro edital) não manda a versão do primeiro", async () => {
    const leitura = criarLeituraPorVersao(OPCOES);
    const rpc = banco({ obter_x_se_mudou: { versao: "v1", candidatos: [] } });
    await leitura.ler(rpc, { p_edital: "e1" }, "e1");
    await leitura.ler(rpc, { p_edital: "e2" }, "e2");
    expect(rpc).toHaveBeenLastCalledWith("obter_x_se_mudou", {
      p_edital: "e2",
      p_versao: null,
    });
  });

  it("banco sem a RPC nova: a de sempre, e não tenta a nova de novo", async () => {
    const leitura = criarLeituraPorVersao(OPCOES);
    const ausente = Object.assign(new Error("Could not find"), {
      code: "PGRST202",
    });
    const rpc = banco({ obter_x_se_mudou: ausente, obter_x: { ok: 1 } });
    expect(await leitura.ler(rpc, { p_edital: "e1" }, "e1")).toEqual({
      ok: 1,
    });
    expect(await leitura.ler(rpc, { p_edital: "e1" }, "e1")).toEqual({
      ok: 1,
    });
    expect(rpc.mock.calls.map(([nome]) => nome)).toEqual([
      "obter_x_se_mudou",
      "obter_x",
      "obter_x",
    ]);
  });

  it("outro erro (permissão, rede) sobe sem tentar a antiga", async () => {
    const leitura = criarLeituraPorVersao(OPCOES);
    const negado = Object.assign(new Error("negado"), { code: "42501" });
    const rpc = banco({ obter_x_se_mudou: negado, obter_x: { ok: 1 } });
    await expect(leitura.ler(rpc, {}, "e1")).rejects.toBe(negado);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("resposta vazia: lê pela antiga (sem guardar versão)", async () => {
    const leitura = criarLeituraPorVersao(OPCOES);
    const rpc = banco({ obter_x_se_mudou: null, obter_x: { ok: 1 } });
    expect(await leitura.ler(rpc, { p_edital: "e1" }, "e1")).toEqual({
      ok: 1,
    });
  });

  it("com cópia no navegador: manda a versão guardada e guarda o que veio em colunas", async () => {
    const guardadas = new Map([
      ["e1", { versao: "v0", candidatos_em_colunas: PACOTE }],
    ]);
    const copias = {
      ler: vi.fn(async (chave) => guardadas.get(chave) ?? null),
      guardar: vi.fn(async (chave, payload) => guardadas.set(chave, payload)),
    };
    const leitura = criarLeituraPorVersao({ ...OPCOES, copias });
    const rpc = banco({
      obter_x_se_mudou: ({ p_versao }) =>
        p_versao === "v0"
          ? { inalterado: true, versao: "v0" }
          : { versao: "v1", candidatos: [] },
    });
    const dados = await leitura.ler(rpc, { p_edital: "e1" }, "e1");
    expect(rpc).toHaveBeenLastCalledWith("obter_x_se_mudou", {
      p_edital: "e1",
      p_versao: "v0",
    });
    expect(dados.candidatos).toHaveLength(3);
    expect(copias.guardar).not.toHaveBeenCalled();

    await leitura.ler(rpc, { p_edital: "e2" }, "e2");
    expect(copias.guardar).toHaveBeenCalledWith("e2", {
      versao: "v1",
      candidatos: [],
    });
  });

  it("esquecer: a próxima leitura não manda a versão da memória", async () => {
    const leitura = criarLeituraPorVersao(OPCOES);
    const rpc = banco({ obter_x_se_mudou: { versao: "v1" } });
    await leitura.ler(rpc, {}, "e1");
    leitura.esquecer();
    await leitura.ler(rpc, {}, "e1");
    expect(rpc).toHaveBeenLastCalledWith("obter_x_se_mudou", {
      p_versao: null,
    });
  });
});

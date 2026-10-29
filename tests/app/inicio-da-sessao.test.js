import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  criarInicioDaSessao,
  parteDoInicio,
} from "../../src/app/inicio-da-sessao.ts";

/*
  O início da sessão numa chamada (src/app/inicio-da-sessao.ts):
  obter_inicio_da_sessao traz configuração, painéis, abas, situação e
  unidades; sem ela, cada parte vai pela consulta de antes, uma vez só.
*/

const INICIO = {
  configuracao: [{ chave: "app_title", valor: "MONITORA", descricao: null }],
  paineis: [{ id: "1", codigo: "bi" }],
  abas: [{ id: "aprovados" }],
  situacao: { sistema: { ativo: true } },
  unidades: [{ id_unidade: "1", nome_oficial: "DSEI Xingu" }],
};

function avulsasFalsas() {
  const avulsa = (nome) =>
    vi.fn(async () => ({ data: `avulsa:${nome}`, error: null }));
  return {
    config: avulsa("config"),
    paineis: avulsa("paineis"),
    abas: avulsa("abas"),
    situacao: avulsa("situacao"),
    unidades: avulsa("unidades"),
  };
}

describe("parteDoInicio", () => {
  it("lê cada parte pela chave do banco; sem ela, null", () => {
    const resposta = { data: INICIO, error: null };
    expect(parteDoInicio(resposta, "config")).toEqual({
      data: INICIO.configuracao,
      error: null,
    });
    expect(parteDoInicio(resposta, "situacao").data).toBe(INICIO.situacao);
    expect(
      parteDoInicio({ data: { paineis: [] }, error: null }, "abas"),
    ).toBeNull();
    expect(
      parteDoInicio({ data: null, error: { code: "PGRST202" } }, "config"),
    ).toBeNull();
    expect(parteDoInicio({ data: [], error: null }, "config")).toBeNull();
  });
});

describe("criarInicioDaSessao", () => {
  it("uma chamada para as cinco partes; o pedido feito cedo é reaproveitado", async () => {
    const rpc = vi.fn(async () => ({ data: INICIO, error: null }));
    const inicio = criarInicioDaSessao({ cliente: () => ({ rpc }) });
    void inicio.pedir();
    const config = await inicio.parte("config", vi.fn());
    const avulsas = avulsasFalsas();
    const partes = inicio.partes(avulsas);
    expect(config.data).toBe(INICIO.configuracao);
    expect((await partes.config).data).toBe(INICIO.configuracao);
    expect((await partes.unidades).data).toBe(INICIO.unidades);
    expect((await partes.abas).data).toBe(INICIO.abas);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("obter_inicio_da_sessao");
    for (const avulsa of Object.values(avulsas))
      expect(avulsa).not.toHaveBeenCalled();
  });

  it("sem a função no banco: cada parte pela consulta de antes, uma vez só", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "PGRST202" },
    }));
    const inicio = criarInicioDaSessao({ cliente: () => ({ rpc }) });
    const avulsas = avulsasFalsas();
    await inicio.parte("config", avulsas.config);
    const partes = inicio.partes(avulsas);
    expect((await partes.config).data).toBe("avulsa:config");
    expect((await partes.situacao).data).toBe("avulsa:situacao");
    expect(avulsas.config).toHaveBeenCalledTimes(1);
    expect(avulsas.situacao).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rede caída no início e na avulsa: a parte responde com o erro, sem rejeitar", async () => {
    const inicio = criarInicioDaSessao({
      cliente: () => ({
        rpc: async () => Promise.reject(new TypeError("Failed to fetch")),
      }),
    });
    const resposta = await inicio.parte("paineis", async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(resposta.data).toBeNull();
    expect(resposta.error).toBeInstanceOf(TypeError);
  });

  it("esquecer: o próximo pedido vai ao banco de novo", async () => {
    const rpc = vi.fn(async () => ({ data: INICIO, error: null }));
    const inicio = criarInicioDaSessao({ cliente: () => ({ rpc }) });
    await inicio.parte("config", vi.fn());
    inicio.esquecer();
    await inicio.parte("config", vi.fn());
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe("registro de navegação sem prender a página", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "chave-de-teste");
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("registrar_navegacao_monitora e registrar_evento_acesso saem com keepalive; o resto, não", async () => {
    const pedidos = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opcoes) => {
        pedidos.push({
          url: String(url),
          keepalive: opcoes?.keepalive === true,
        });
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const { getSupabaseClient } = await import("../../src/lib/supabaseClient");
    const cliente = getSupabaseClient();
    await cliente.rpc("registrar_navegacao_monitora", { p_presenca: true });
    await cliente.rpc("registrar_evento_acesso", { p_evento: "logout" });
    await cliente.rpc("obter_inicio_da_sessao");
    const porRpc = Object.fromEntries(
      pedidos
        .filter((p) => p.url.includes("/rest/v1/rpc/"))
        .map((p) => [p.url.split("/rpc/")[1], p.keepalive]),
    );
    expect(porRpc).toEqual({
      registrar_navegacao_monitora: true,
      registrar_evento_acesso: true,
      obter_inicio_da_sessao: false,
    });
  });
});

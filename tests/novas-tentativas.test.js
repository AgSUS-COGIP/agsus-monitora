import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  POLITICA_PADRAO,
  comNovasTentativas,
  criarOrcamento,
  ehTokenVencido,
  esperaAntesDaTentativa,
  esperaPedidaPeloServidor,
} from "../src/lib/novas-tentativas.ts";
import { esperaDaReleitura } from "../src/lib/classificacao/relatorio-de-desempate.ts";

const REST = "https://x.supabase.co/rest/v1/TB_CONFIGURACAO?select=*";
const RPC = "https://x.supabase.co/rest/v1/rpc/salvar_algo";

function resposta(status, corpo = {}, cabecalhos = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json", ...cabecalhos },
  });
}

function montar(respostas, opcoes = {}) {
  const fila = [...respostas];
  const base = vi.fn(async () => {
    const proxima = fila.shift();
    if (proxima instanceof Error) throw proxima;
    return proxima;
  });
  const esperas = [];
  const fetch = comNovasTentativas(base, {
    esperar: async (ms) => {
      esperas.push(ms);
    },
    sorteio: () => 1,
    ...opcoes,
  });
  return { base, esperas, fetch };
}

describe("espera crescente com sorteio e teto", () => {
  it("dobra a cada tentativa, com metade sorteada, até o teto", () => {
    const politica = { baseMs: 500, tetoMs: 8000 };
    expect(esperaAntesDaTentativa(1, politica, () => 1)).toBe(500);
    expect(esperaAntesDaTentativa(1, politica, () => 0)).toBe(250);
    expect(esperaAntesDaTentativa(2, politica, () => 1)).toBe(1000);
    expect(esperaAntesDaTentativa(3, politica, () => 1)).toBe(2000);
    expect(esperaAntesDaTentativa(10, politica, () => 1)).toBe(8000);
    expect(esperaAntesDaTentativa(10, politica, () => 0)).toBe(4000);
  });

  it("lê o Retry-After em segundos ou em data", () => {
    expect(esperaPedidaPeloServidor("3")).toBe(3000);
    expect(
      esperaPedidaPeloServidor(
        "Wed, 29 Oct 2026 12:00:10 GMT",
        Date.parse("2026-10-29T12:00:00Z"),
      ),
    ).toBe(10000);
    expect(esperaPedidaPeloServidor("")).toBeNull();
    expect(esperaPedidaPeloServidor("amanhã")).toBeNull();
  });

  it("a releitura do relatório de desempate cresce de 10 s até 60 s", () => {
    expect(esperaDaReleitura(1, () => 1)).toBe(10000);
    expect(esperaDaReleitura(2, () => 1)).toBe(20000);
    expect(esperaDaReleitura(9, () => 1)).toBe(60000);
  });
});

describe("o que é repetido", () => {
  it("leitura com status passageiro: repete até o limite e devolve a última", async () => {
    const { base, esperas, fetch } = montar([
      resposta(503),
      resposta(503),
      resposta(503),
      resposta(200),
    ]);
    const final = await fetch(REST, { method: "GET" });
    expect(final.status).toBe(503);
    expect(base).toHaveBeenCalledTimes(POLITICA_PADRAO.maximoDeTentativas);
    expect(esperas).toEqual([500, 1000]);
  });

  it("leitura que falhou na rede: repete e devolve a que deu certo", async () => {
    const { base, fetch } = montar([
      new TypeError("Failed to fetch"),
      resposta(200, []),
    ]);
    const final = await fetch(REST, { method: "GET" });
    expect(final.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("gravação (POST de RPC) nunca é repetida às cegas", async () => {
    const { base, fetch } = montar([resposta(503), resposta(200)]);
    expect((await fetch(RPC, { method: "POST", body: "{}" })).status).toBe(503);
    const falha = montar([new TypeError("Failed to fetch")]);
    await expect(
      falha.fetch(RPC, { method: "POST", body: "{}" }),
    ).rejects.toThrow("Failed to fetch");
    expect(base).toHaveBeenCalledTimes(1);
    expect(falha.base).toHaveBeenCalledTimes(1);
  });

  it("cancelamento e status definitivos não são repetidos", async () => {
    const abortada = Object.assign(new Error("abortada"), {
      name: "AbortError",
    });
    const cancelada = montar([abortada]);
    await expect(cancelada.fetch(REST, { method: "GET" })).rejects.toBe(
      abortada,
    );
    expect(cancelada.base).toHaveBeenCalledTimes(1);
    const definitiva = montar([resposta(404), resposta(200)]);
    expect((await definitiva.fetch(REST, { method: "GET" })).status).toBe(404);
    expect(definitiva.base).toHaveBeenCalledTimes(1);
  });

  it("Retry-After maior que o teto devolve a resposta sem esperar", async () => {
    const { base, esperas, fetch } = montar([
      resposta(429, {}, { "Retry-After": "120" }),
      resposta(200),
    ]);
    expect((await fetch(REST)).status).toBe(429);
    expect(base).toHaveBeenCalledTimes(1);
    expect(esperas).toEqual([]);
  });

  it("Retry-After dentro do teto é respeitado", async () => {
    const { esperas, fetch } = montar([
      resposta(503, {}, { "Retry-After": "2" }),
      resposta(200),
    ]);
    expect((await fetch(REST)).status).toBe(200);
    expect(esperas).toEqual([2000]);
  });

  it("Auth, Realtime e Edge Functions passam direto", async () => {
    const { base, fetch } = montar([resposta(503), resposta(200)]);
    const final = await fetch(
      "https://x.supabase.co/auth/v1/token?grant_type=refresh_token",
      {
        method: "GET",
      },
    );
    expect(final.status).toBe(503);
    expect(base).toHaveBeenCalledTimes(1);
  });
});

describe("orçamento comum", () => {
  it("com o banco fora, as chamadas juntas não passam do orçamento da janela", async () => {
    let agora = 0;
    const orcamento = criarOrcamento(
      { novasPorJanela: 3, janelaMs: 30000 },
      () => agora,
    );
    const base = vi.fn(async () => resposta(503));
    const fetch = comNovasTentativas(base, {
      orcamento,
      esperar: async () => {},
      sorteio: () => 0,
    });
    await Promise.all(Array.from({ length: 5 }, () => fetch(REST)));
    expect(base).toHaveBeenCalledTimes(5 + 3);
    agora = 31000;
    expect(orcamento.gastar()).toBe(true);
  });
});

describe("token vencido", () => {
  const vencido = { code: "PGRST303", message: "JWT expired" };

  it("reconhece o 401 de token vencido, não o de permissão", () => {
    expect(ehTokenVencido(vencido)).toBe(true);
    expect(ehTokenVencido({ code: "PGRST301" })).toBe(true);
    expect(
      ehTokenVencido({ code: "42501", message: "permission denied" }),
    ).toBe(false);
    expect(ehTokenVencido(null)).toBe(false);
  });

  it("renova uma vez e reenvia a mesma chamada (inclusive gravação) com o token novo", async () => {
    const renovarToken = vi.fn(async () => "novo");
    const { base, fetch } = montar([resposta(401, vencido), resposta(200)], {
      renovarToken,
    });
    const final = await fetch(RPC, {
      method: "POST",
      body: '{"p":1}',
      headers: new Headers({ Authorization: "Bearer velho" }),
    });
    expect(final.status).toBe(200);
    expect(renovarToken).toHaveBeenCalledWith("velho");
    const [, segunda] = base.mock.calls[1];
    expect(new Headers(segunda.headers).get("Authorization")).toBe(
      "Bearer novo",
    );
    expect(segunda.body).toBe('{"p":1}');
  });

  it("não insiste: sem token novo, ou 401 de novo, devolve o 401", async () => {
    const semToken = montar([resposta(401, vencido)], {
      renovarToken: async () => null,
    });
    expect(
      (
        await semToken.fetch(RPC, {
          method: "POST",
          headers: { Authorization: "Bearer a" },
        })
      ).status,
    ).toBe(401);
    const deNovo = montar(
      [resposta(401, vencido), resposta(401, vencido), resposta(200)],
      {
        renovarToken: async () => "b",
      },
    );
    expect(
      (
        await deNovo.fetch(RPC, {
          method: "POST",
          headers: { Authorization: "Bearer a" },
        })
      ).status,
    ).toBe(401);
    expect(deNovo.base).toHaveBeenCalledTimes(2);
  });
});

describe("o cliente único usa esta regra", () => {
  it("desliga a repetição da biblioteca e passa o fetch por comNovasTentativas", () => {
    const fonte = readFileSync("src/lib/supabaseClient.ts", "utf8");
    expect(fonte).toMatch(/db:\s*\{\s*retry:\s*false\s*\}/);
    expect(fonte).toMatch(/comNovasTentativas\(/);
  });
});

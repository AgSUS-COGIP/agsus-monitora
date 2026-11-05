import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/editais.js";
import {
  editaisDaApi,
  filtrosDaApi,
  totaisDaApi,
} from "../src/lib/editais-da-api.js";

const LINHAS = [
  {
    id: 1,
    unidade: "DSEI Yanomami",
    edital: "001/2026",
    status: "Em andamento",
    etapa: "Análise curricular",
    vagas_total: 10,
    contratados: 4,
    vagas_ociosas: 6,
    risco: "Alto",
    link_edital: "https://exemplo.gov.br/edital-001.pdf",
    observacoes_internas: "não sai na API",
  },
  {
    id: 2,
    unidade: "DSEI Alto Rio Negro",
    edital: "002/2026",
    status: "Concluído",
    etapa: "Contratação",
    vagas_total: "5",
    contratados: "5",
    vagas_ociosas: null,
    risco: "Médio",
  },
];

describe("formato da API de editais", () => {
  it("devolve só os campos pedidos (com o id e o link), com números", () => {
    expect(editaisDaApi({ linhas: LINHAS })).toEqual([
      {
        id: 1,
        unidade: "DSEI Yanomami",
        edital: "001/2026",
        status: "Em andamento",
        etapa: "Análise curricular",
        vagas: 10,
        contratados: 4,
        ociosas: 6,
        risco: "Alto",
        link: "https://exemplo.gov.br/edital-001.pdf",
      },
      {
        id: 2,
        unidade: "DSEI Alto Rio Negro",
        edital: "002/2026",
        status: "Concluído",
        etapa: "Contratação",
        vagas: 5,
        contratados: 5,
        ociosas: 0,
        risco: "Médio",
        link: "",
      },
    ]);
  });

  it("aceita a lista crua e payload vazio", () => {
    expect(editaisDaApi(LINHAS)).toHaveLength(2);
    expect(editaisDaApi({ inalterado: true })).toEqual([]);
    expect(editaisDaApi(null)).toEqual([]);
  });

  it("filtra risco/status sem caixa nem acento e edital/unidade por trecho", () => {
    expect(editaisDaApi(LINHAS, { risco: "medio" }).map((e) => e.id)).toEqual([
      2,
    ]);
    expect(
      editaisDaApi(LINHAS, { status: "CONCLUIDO" }).map((e) => e.id),
    ).toEqual([2]);
    expect(
      editaisDaApi(LINHAS, { unidade: "yanomami" }).map((e) => e.id),
    ).toEqual([1]);
    expect(editaisDaApi(LINHAS, { edital: "2026" })).toHaveLength(2);
    expect(editaisDaApi(LINHAS, { risco: "Baixo" })).toEqual([]);
  });

  it("lê o primeiro valor de filtro repetido e ignora os desconhecidos", () => {
    expect(filtrosDaApi({ risco: ["Alto", "Baixo"], outro: "x" })).toEqual({
      edital: "",
      unidade: "",
      status: "",
      etapa: "",
      risco: "Alto",
    });
  });

  it("soma os totais", () => {
    expect(totaisDaApi(editaisDaApi(LINHAS))).toEqual({
      linhas: 2,
      vagas: 15,
      contratados: 9,
      ociosas: 6,
    });
  });
});

function respostaFalsa() {
  const res = { statusCode: 0, headers: {}, corpo: "" };
  res.status = (s) => ((res.statusCode = s), res);
  res.setHeader = (k, v) => ((res.headers[k.toLowerCase()] = v), res);
  res.end = (c = "") => ((res.corpo = c), res);
  return res;
}

const json = (corpo, ok = true) => ({ ok, json: async () => corpo });

const CHAVE = "chave-da-api-combinada";
const SERVIDOR = "sb_secret_servidor";
const comChave = (chave = CHAVE, extra = {}) => ({
  method: "GET",
  headers: { authorization: `Bearer ${chave}` },
  ...extra,
});

describe("GET /api/editais (chave fixa, sem login)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVIDOR);
    vi.stubEnv("EDITAIS_API_CHAVE", CHAVE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("recusa método que não é GET", async () => {
    const res = respostaFalsa();
    await handler({ method: "POST", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("sem as variáveis na Vercel responde 500 sem chamar o banco", async () => {
    vi.stubEnv("EDITAIS_API_CHAVE", "");
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    const res = respostaFalsa();
    await handler(comChave(), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.corpo)).toEqual({
      erro: "configuracao_ausente",
      faltam: ["EDITAIS_API_CHAVE"],
    });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("o 500 diz só os nomes que faltam, nunca os valores", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "   \n");
    const res = respostaFalsa();
    await handler(comChave(), res);
    expect(JSON.parse(res.corpo).faltam).toEqual([
      "VITE_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
    expect(res.corpo).not.toContain(CHAVE);
  });

  it("aceita SUPABASE_URL e apara espaço e quebra de linha colados", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", " https://outro.supabase.co/ ");
    vi.stubEnv("EDITAIS_API_CHAVE", `${CHAVE}\n`);
    const fetchFalso = vi.fn(async () => json({ linhas: [] }));
    vi.stubGlobal("fetch", fetchFalso);
    const res = respostaFalsa();
    await handler(comChave(), res);
    expect(res.statusCode).toBe(200);
    expect(fetchFalso.mock.calls[0][0]).toBe(
      "https://outro.supabase.co/rest/v1/rpc/listar_monitoramento_operacional",
    );
  });

  it("sem chave ou com chave errada: 401, sem chamar o banco", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    for (const pedido of [
      { method: "GET", headers: {} },
      comChave("outra-chave"),
      comChave(`${CHAVE}x`),
    ]) {
      const res = respostaFalsa();
      await handler(pedido, res);
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.corpo)).toEqual({ erro: "chave_invalida" });
    }
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("com a chave certa lê a RPC com a chave de servidor e filtra", async () => {
    const fetchFalso = vi.fn(async () => json({ linhas: LINHAS, versao: "v" }));
    vi.stubGlobal("fetch", fetchFalso);

    const res = respostaFalsa();
    await handler(comChave(CHAVE, { query: { risco: "alto" } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toBe(
      "https://exemplo.supabase.co/rest/v1/rpc/listar_monitoramento_operacional",
    );
    expect(opcoes.headers.apikey).toBe(SERVIDOR);
    // Chave nova (sb_secret_…) não vai no Authorization; a chave da API nunca vai ao banco.
    expect(opcoes.headers.Authorization).toBeUndefined();
    expect(JSON.stringify(opcoes)).not.toContain(CHAVE);
    const corpo = JSON.parse(res.corpo);
    expect(corpo.editais.map((e) => e.id)).toEqual([1]);
    expect(corpo.editais[0].link).toBe("https://exemplo.gov.br/edital-001.pdf");
    expect(corpo.totais).toEqual({
      linhas: 1,
      vagas: 10,
      contratados: 4,
      ociosas: 6,
    });
  });

  it("chave de servidor antiga (JWT) vai também no Authorization", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJservidor");
    const fetchFalso = vi.fn(async () => json({ linhas: [] }));
    vi.stubGlobal("fetch", fetchFalso);
    await handler(comChave(), respostaFalsa());
    expect(fetchFalso.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer eyJservidor",
    );
  });

  it("falha da leitura vira 502 com status e código, sem a mensagem", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          code: "42501",
          message: "permission denied for view X",
        }),
      })),
    );
    const res = respostaFalsa();
    await handler(comChave(), res);
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.corpo)).toEqual({
      erro: "falha_na_leitura",
      status_do_banco: 403,
      codigo: "42501",
    });
    expect(res.corpo).not.toContain("permission denied");
    expect(console.error).toHaveBeenCalled();
  });

  it("sem resposta do banco: 502 com status nulo", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("rede");
      }),
    );
    const res = respostaFalsa();
    await handler(comChave(), res);
    expect(JSON.parse(res.corpo)).toEqual({
      erro: "falha_na_leitura",
      status_do_banco: null,
      codigo: null,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aplicarLocalizacoes,
  casaisNacionaisDoSigepsi,
  localizacoesPorDsei,
  tipoDaLocalizacao,
  ufDoCep,
} from "../../src/lib/mapas/mapa-saude-indigena/localizacoes-do-sigepsi.ts";
import {
  registrosDoDsei,
  resumoDaRede,
} from "../../src/lib/mapas/mapa-saude-indigena/mapa-do-dsei.ts";
import { casaisNacionaisDoMapa } from "../../src/lib/mapas/mapa-saude-indigena/dados-do-mapa.ts";
import type { DseiDoMapa } from "../../src/lib/mapas/mapa-saude-indigena/tipos.ts";
import type {
  PedidoDaVercel,
  RespostaDaVercel,
} from "../../api/_tipos-da-vercel.ts";

/* Linhas no formato da API do SIGEPSI (/api/mapa-dseis/localizacoes/todas). */
const linha = (campos: Record<string, unknown> = {}) => ({
  CO_SEQ_LOCALIZACAO_POLO_BASE: "2",
  NO_DSEI: "ALAGOAS E SERGIPE",
  TP_UNIDADE: "POLO BASE",
  NO_LOTACAO: "PB ACONÃ",
  NU_CEP: "57370000",
  NO_MUNICIPIO: "TRAIPU",
  CG_LATITUDE: "-9.97100000000000",
  CG_LONGITUDE: "-37.00300000000000",
  ST_REGISTRO_ATIVO: "S",
  ...campos,
});

const CASAI = linha({
  CO_SEQ_LOCALIZACAO_POLO_BASE: "1",
  TP_UNIDADE: "CASAI",
  NO_LOTACAO: "CASAI DSEI AL/SE",
  NU_CEP: "57052483",
  NO_MUNICIPIO: "MACEIO",
  CG_LATITUDE: "-9.62718000000000",
  CG_LONGITUDE: "-35.73629000000000",
});

const SEDE = linha({
  CO_SEQ_LOCALIZACAO_POLO_BASE: "3",
  TP_UNIDADE: "SEDE",
  NO_LOTACAO: "SEDE DSEI",
  NU_CEP: "57062280",
  NO_MUNICIPIO: "MACEIO",
  CG_LATITUDE: "-9.60197",
  CG_LONGITUDE: "-35.7481",
});

const LOTACAO = linha({
  CO_SEQ_LOCALIZACAO_POLO_BASE: "4",
  TP_UNIDADE: "UNIDADE DE LOTAÇÃO",
  NO_LOTACAO: "NOVO DIA",
  NO_MUNICIPIO: "PORTO REAL DO COLEGIO",
  CG_LATITUDE: "-10.1",
  CG_LONGITUDE: "-36.8",
});

/* As CASAIs nacionais do SIGEPSI: localizações 131 (DF) e 132 (São Paulo). */
const CASAI_DF = linha({
  CO_SEQ_LOCALIZACAO_POLO_BASE: "131",
  NO_DSEI: "CASAI DF",
  TP_UNIDADE: "CASAI",
  NO_LOTACAO: "CASAI DF",
  NU_CEP: "",
  NO_MUNICIPIO: "BRASILIA",
  CG_LATITUDE: "-15.7432",
  CG_LONGITUDE: "-47.7133",
});
const CASAI_SP = linha({
  CO_SEQ_LOCALIZACAO_POLO_BASE: "132",
  NO_DSEI: "CASAI SÃO PAULO",
  TP_UNIDADE: "CASAI",
  NO_LOTACAO: "CASAI SÃO PAULO",
  NU_CEP: "05161000",
  NO_MUNICIPIO: "SAO PAULO",
  CG_LATITUDE: "-23.5821",
  CG_LONGITUDE: "-46.6136",
});

describe("CASAIs só do SIGEPSI", () => {
  it("as nacionais são as localizações 131 e 132, fora da lista de DSEIs", () => {
    const linhas = [CASAI, CASAI_DF, CASAI_SP];
    expect(casaisNacionaisDoSigepsi(linhas)).toEqual([
      ["CASAI DF", "131", -15.7432, -47.7133, "BRASILIA", "DF"],
      ["CASAI SÃO PAULO", "132", -23.5821, -46.6136, "SAO PAULO", "SP"],
    ]);
    // A CASAI de um DSEI não é nacional; as nacionais não viram DSEI.
    expect(Object.keys(localizacoesPorDsei(linhas))).toEqual([
      "ALAGOAS SERGIPE",
    ]);
    expect(
      casaisNacionaisDoSigepsi([
        linha({ ...CASAI_DF, ST_REGISTRO_ATIVO: "N" }),
      ]),
    ).toEqual([]);
  });

  it("a validação do mapa aceita as CASAIs nacionais e ignora lixo", () => {
    const nacionais = casaisNacionaisDoSigepsi([CASAI_DF, CASAI_SP]);
    expect(casaisNacionaisDoMapa([...nacionais, "x", [null], null])).toEqual(
      nacionais,
    );
  });
});

describe("localizacoesPorDsei", () => {
  it("agrupa pela chave do DSEI, com tipo, UF pelo CEP e origem", () => {
    const porDsei = localizacoesPorDsei([CASAI, linha(), LOTACAO, SEDE]);
    expect(Object.keys(porDsei)).toEqual(["ALAGOAS SERGIPE"]);
    expect(porDsei["ALAGOAS SERGIPE"]?.polos).toEqual([
      {
        n: "CASAI DSEI AL/SE",
        lat: -9.62718,
        lon: -35.73629,
        uf: "AL",
        cod: "1",
        tipo: "casai",
        municipio: "MACEIO",
        origem: "sigepsi",
      },
      expect.objectContaining({ n: "PB ACONÃ", tipo: "polo", uf: "AL" }),
      expect.objectContaining({ n: "NOVO DIA", tipo: "unidade" }),
    ]);
    expect(porDsei["ALAGOAS SERGIPE"]?.sede).toEqual({
      lat: -9.60197,
      lon: -35.7481,
      uf: "AL",
      municipio: "MACEIO",
    });
  });

  it("ignora inativas, sem coordenada, 0,0, tipo desconhecido e lixo", () => {
    const porDsei = localizacoesPorDsei([
      linha({ ST_REGISTRO_ATIVO: "N" }),
      linha({ CG_LATITUDE: "" }),
      linha({ CG_LATITUDE: "0", CG_LONGITUDE: "0" }),
      linha({ NO_DSEI: "" }),
      linha({ TP_UNIDADE: "OUTRA COISA" }),
      // CASAI nacional no lugar do DSEI: não é distrito.
      linha({ NO_DSEI: "CASAI DF", TP_UNIDADE: "CASAI" }),
      null,
      "texto",
    ]);
    // O DSEI ativo existe mesmo sem nenhum ponto utilizável.
    expect(porDsei).toEqual({
      "ALAGOAS SERGIPE": { nome: "ALAGOAS E SERGIPE", polos: [], sede: null },
    });
    expect(localizacoesPorDsei({ nao: "lista" })).toEqual({});
  });

  it("tipo e UF", () => {
    expect(tipoDaLocalizacao("CASAI")).toBe("casai");
    expect(tipoDaLocalizacao("Polo Base")).toBe("polo");
    expect(tipoDaLocalizacao("ROTA")).toBe("polo");
    expect(tipoDaLocalizacao("SEDE")).toBe("sede");
    expect(tipoDaLocalizacao("UNIDADE DE LOTAÇÃO", "UBSI X")).toBe("unidade");
    expect(tipoDaLocalizacao("UNIDADE DE LOTAÇÃO", "PB X")).toBe("polo");
    expect(tipoDaLocalizacao("UNIDADE DE LOTAÇÃO", "CASAI X")).toBe("casai");
    expect(tipoDaLocalizacao("OUTRA")).toBeNull();
    expect(ufDoCep("69301-000")).toBe("RR");
    expect(ufDoCep("70040-010")).toBe("DF");
    expect(ufDoCep("123")).toBe("");
  });
});

describe("aplicarLocalizacoes", () => {
  const lmap = {
    dsei: [
      {
        k: "YANOMAMI",
        n: "Yanomami",
        polos: [{ n: "POLO DO BANCO", lat: 2, lon: -61 }],
      },
      {
        k: "ALAGOAS E SERGIPE",
        n: "Alagoas e Sergipe",
        lat: -9.6,
        lon: -35.7,
        pop: 12000,
        ufs: ["AL", "SE"],
        sedeuf: "AL",
        sede_municipio: "Maceió",
        polos: [{ n: "POLO ANTIGO", lat: -9, lon: -36, uf: "AL" }],
      },
    ],
    casai: [{ n: "CASAI Nacional Brasília" }],
  };

  it("a lista é a do SIGEPSI; do banco, só nome, população e UFs", () => {
    const porDsei = localizacoesPorDsei([
      CASAI,
      linha(),
      SEDE,
      linha({
        NO_DSEI: "MÉDIO RIO SOLIMÕES E AFLUENTES",
        TP_UNIDADE: "SEDE",
        NU_CEP: "69553000",
        NO_MUNICIPIO: "TEFE",
        CG_LATITUDE: "-3.35",
        CG_LONGITUDE: "-64.71",
      }),
    ]);
    const novo = aplicarLocalizacoes(lmap, porDsei);
    // Yanomami (só no banco) sai; o DSEI só do SIGEPSI entra; nada mais do banco.
    expect(novo).toEqual({
      dsei: [
        {
          k: "ALAGOAS E SERGIPE",
          n: "Alagoas e Sergipe",
          pop: 12000,
          ufs: ["AL", "SE"],
          sedeuf: "AL",
          polos: porDsei["ALAGOAS SERGIPE"]?.polos,
          lat: -9.60197,
          lon: -35.7481,
          sede_municipio: "MACEIO",
          sede_uf: "AL",
        },
        {
          k: "MÉDIO RIO SOLIMÕES E AFLUENTES",
          n: "Médio Rio Solimões e Afluentes",
          ufs: ["AM"],
          sedeuf: "AM",
          polos: [],
          lat: -3.35,
          lon: -64.71,
          sede_municipio: "TEFE",
          sede_uf: "AM",
        },
      ],
    });
  });

  it("sem sede no SIGEPSI, o DSEI fica sem posição (a do banco não vale)", () => {
    const [dsei] = aplicarLocalizacoes(
      lmap,
      localizacoesPorDsei([linha()]),
    ).dsei;
    expect(dsei).not.toHaveProperty("lat");
    expect(dsei).not.toHaveProperty("sede_municipio");
  });

  it("sem o banco, a lista do SIGEPSI basta", () => {
    expect(aplicarLocalizacoes(null, localizacoesPorDsei([SEDE])).dsei).toEqual(
      [expect.objectContaining({ n: "Alagoas e Sergipe", ufs: ["AL"] })],
    );
  });
});

describe("no mapa do DSEI", () => {
  const { dsei } = aplicarLocalizacoes(
    { dsei: [{ k: "ALAGOAS E SERGIPE", n: "Alagoas e Sergipe" }] },
    localizacoesPorDsei([
      CASAI,
      linha(),
      LOTACAO,
      linha({ NO_LOTACAO: "UBSI BANANAL", TP_UNIDADE: "UNIDADE DE LOTAÇÃO" }),
      SEDE,
    ]),
  ) as { dsei: DseiDoMapa[] };
  const distrito = dsei[0]!;

  it("só os pontos do SIGEPSI, com o tipo de TP_UNIDADE e do nome", () => {
    const registros = registrosDoDsei(distrito);
    expect(
      registros.map((r) => [r.name, r.type.key, r.city, r.uf, r.origens]),
    ).toEqual([
      ["CASAI DSEI AL/SE", "casai", "MACEIO", "AL", ["sigepsi"]],
      ["PB ACONÃ", "polo", "TRAIPU", "AL", ["sigepsi"]],
      ["NOVO DIA", "unit", "PORTO REAL DO COLEGIO", "AL", ["sigepsi"]],
      ["UBSI BANANAL", "ubsi", "TRAIPU", "AL", ["sigepsi"]],
    ]);
    expect(resumoDaRede(distrito, registros)[0]).toBe("Polos base: 1");
  });
});

describe("/api/dseis", () => {
  const ambiente = { ...process.env };
  const original = globalThis.fetch;

  /* A resposta da Vercel guardando o que a função escreveu. */
  function respostaFalsa() {
    const gravado = {
      codigo: 0,
      cabecalhos: {} as Record<string, string>,
      corpo: "",
    };
    const res: Pick<RespostaDaVercel, "status" | "setHeader" | "end"> = {
      status(codigo) {
        gravado.codigo = codigo;
        return res as RespostaDaVercel;
      },
      setHeader(nome, valor) {
        gravado.cabecalhos[nome] = String(valor);
        return res as RespostaDaVercel;
      },
      end(corpo?: unknown) {
        gravado.corpo = String(corpo ?? "");
        return res as RespostaDaVercel;
      },
    };
    return { gravado, res: res as RespostaDaVercel };
  }

  beforeEach(async () => {
    process.env.VITE_SUPABASE_URL = "https://banco.exemplo";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "pub";
    process.env.SIGEPSI_API_TOKEN = "segredo";
    const { esquecerCache } = await import("../../api/dseis.ts");
    esquecerCache();
  });
  afterEach(() => {
    process.env = { ...ambiente };
    globalThis.fetch = original;
  });

  async function chamar(headers: Record<string, string> = {}) {
    const { default: handler } = await import("../../api/dseis.ts");
    const { gravado, res } = respostaFalsa();
    const pedido: Pick<PedidoDaVercel, "method" | "headers"> = {
      method: "GET",
      headers,
    };
    await handler(pedido as PedidoDaVercel, res);
    const json: unknown = gravado.corpo ? JSON.parse(gravado.corpo) : null;
    return { ...gravado, json };
  }

  const urlDe = (entrada: Parameters<typeof fetch>[0]) =>
    typeof entrada === "string"
      ? entrada
      : entrada instanceof URL
        ? entrada.href
        : entrada.url;

  it("sem o token do SIGEPSI, diz o nome da variável que falta", async () => {
    delete process.env.SIGEPSI_API_TOKEN;
    const r = await chamar();
    expect(r.codigo).toBe(500);
    expect(r.json).toEqual({
      erro: "configuracao_ausente",
      faltam: ["SIGEPSI_API_TOKEN"],
    });
  });

  it("sem sessão, 401 sem chamar o SIGEPSI", async () => {
    const fetchFalso = vi.fn<typeof fetch>();
    globalThis.fetch = fetchFalso;
    const r = await chamar();
    expect(r.codigo).toBe(401);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("com sessão, lê o SIGEPSI com o token do servidor e guarda", async () => {
    const fetchFalso = vi.fn<typeof fetch>(async (entrada) =>
      urlDe(entrada).endsWith("/auth/v1/user")
        ? new Response("{}", { status: 200 })
        : new Response(JSON.stringify([CASAI, CASAI_DF]), { status: 200 }),
    );
    globalThis.fetch = fetchFalso;
    const r = await chamar({ authorization: "Bearer sessao" });
    expect(r.codigo).toBe(200);
    expect(r.json).toMatchObject({
      dseis: {
        "ALAGOAS SERGIPE": {
          polos: [expect.objectContaining({ tipo: "casai" })],
        },
      },
      casaisNacionais: [
        ["CASAI DF", "131", -15.7432, -47.7133, "BRASILIA", "DF"],
      ],
    });
    expect(r.corpo).not.toContain("segredo");
    const opcoes = fetchFalso.mock.calls[1]?.[1];
    expect(new Headers(opcoes?.headers).get("Authorization")).toBe(
      "Bearer segredo",
    );
    expect(r.cabecalhos["Cache-Control"]).toMatch(/^private/);

    await chamar({ authorization: "Bearer sessao" });
    // Segunda vez: confere a sessão, mas não pede de novo ao SIGEPSI.
    expect(fetchFalso).toHaveBeenCalledTimes(3);
  });

  it("SIGEPSI recusando o token vira 502 com o status", async () => {
    globalThis.fetch = vi.fn<typeof fetch>(async (entrada) =>
      urlDe(entrada).endsWith("/auth/v1/user")
        ? new Response("{}", { status: 200 })
        : new Response("", { status: 401 }),
    );
    const r = await chamar({ authorization: "Bearer sessao" });
    expect(r.codigo).toBe(502);
    expect(r.json).toEqual({
      erro: "falha_no_sigepsi",
      status_do_sigepsi: 401,
    });
  });
});

describe("carregarLocalizacoes (navegador)", () => {
  const sessao = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "token-da-sessao" } },
        error: null,
      }),
    },
  };
  const DSEIS = {
    "ALAGOAS SERGIPE": { nome: "ALAGOAS E SERGIPE", polos: [], sede: null },
  };

  beforeEach(async () => {
    const { esquecerLocalizacoes } =
      await import("../../src/modulos/mapa-saude-indigena/localizacoes.ts");
    esquecerLocalizacoes();
  });

  it("manda o token da sessão e guarda por 10 minutos", async () => {
    const { carregarLocalizacoes, CACHE_MS } =
      await import("../../src/modulos/mapa-saude-indigena/localizacoes.ts");
    const buscar = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ dseis: DSEIS, casaisNacionais: [] }), {
          status: 200,
        }),
    );
    let agora = 0;
    const relogio = () => agora;
    expect(await carregarLocalizacoes(sessao, { buscar, relogio })).toEqual({
      dseis: DSEIS,
      casaisNacionais: [],
    });
    const [rota, opcoes] = buscar.mock.calls[0] ?? [];
    expect(rota).toBe("/api/dseis");
    expect(new Headers(opcoes?.headers).get("Authorization")).toBe(
      "Bearer token-da-sessao",
    );
    agora = CACHE_MS - 1;
    await carregarLocalizacoes(sessao, { buscar, relogio });
    expect(buscar).toHaveBeenCalledTimes(1);
    agora = CACHE_MS;
    await carregarLocalizacoes(sessao, { buscar, relogio });
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("falha não fica guardada e devolve null (o mapa usa o banco)", async () => {
    const { carregarLocalizacoes } =
      await import("../../src/modulos/mapa-saude-indigena/localizacoes.ts");
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const buscar = vi.fn<typeof fetch>(
      async () => new Response("", { status: 502 }),
    );
    expect(await carregarLocalizacoes(sessao, { buscar })).toBeNull();
    expect(await carregarLocalizacoes(sessao, { buscar })).toBeNull();
    expect(buscar).toHaveBeenCalledTimes(2);
    aviso.mockRestore();
  });
});

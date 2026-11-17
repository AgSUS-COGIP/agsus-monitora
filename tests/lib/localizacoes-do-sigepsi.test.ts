import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aplicarLocalizacoes,
  localizacoesPorDsei,
  tipoDaLocalizacao,
  ufDoCep,
} from "../../src/lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts";
import {
  registrosDoDsei,
  resumoDaRede,
} from "../../src/lib/mapa-saude-indigena/mapa-do-dsei.ts";
import { pontosEditaveisDoMapa } from "../../src/lib/coordenadas-do-mapa.ts";
import type {
  DseiDoMapa,
  EstabelecimentoCompacto,
} from "../../src/lib/mapa-saude-indigena/tipos.ts";
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
      null,
      "texto",
    ]);
    expect(porDsei).toEqual({});
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
        k: "ALAGOAS E SERGIPE",
        n: "Alagoas e Sergipe",
        lat: -9.6,
        lon: -35.7,
        ufs: ["AL", "SE"],
        sede_municipio: "Maceió",
        polos: [{ n: "POLO ANTIGO", lat: -9, lon: -36, uf: "AL" }],
      },
      {
        k: "YANOMAMI",
        n: "Yanomami",
        polos: [{ n: "POLO DO BANCO", lat: 2, lon: -61 }],
      },
    ],
    casai: [],
  };

  it("troca os polos e a sede dos DSEIs que a API traz; o resto fica", () => {
    const porDsei = localizacoesPorDsei([CASAI, linha(), SEDE]);
    const novo = aplicarLocalizacoes(lmap, porDsei) as typeof lmap;
    expect(novo.dsei[0]).toMatchObject({
      ufs: ["AL", "SE"],
      lat: -9.60197,
      lon: -35.7481,
      sede_municipio: "MACEIO",
      sede_uf: "AL",
      sede_origem: "sigepsi",
    });
    expect(novo.dsei[0]?.polos.map((p) => p.n)).toEqual([
      "CASAI DSEI AL/SE",
      "PB ACONÃ",
    ]);
    expect(novo.dsei[1]).toBe(lmap.dsei[1]);
    expect(novo.casai).toBe(lmap.casai);
  });

  it("sem sede na API, a sede do banco fica", () => {
    const novo = aplicarLocalizacoes(
      lmap,
      localizacoesPorDsei([linha()]),
    ) as typeof lmap;
    expect(novo.dsei[0]).toMatchObject({ lat: -9.6, sede_municipio: "Maceió" });
    expect(novo.dsei[0]).not.toHaveProperty("sede_origem");
  });

  it("sem localizações, devolve o lmap do banco", () => {
    expect(aplicarLocalizacoes(lmap, null)).toBe(lmap);
    expect(aplicarLocalizacoes(lmap, {})).toBe(lmap);
    expect(aplicarLocalizacoes(null, { X: { polos: [], sede: null } })).toBe(
      null,
    );
  });
});

describe("no mapa do DSEI e no editor", () => {
  const lmap = aplicarLocalizacoes(
    {
      dsei: [{ k: "ALAGOAS E SERGIPE", n: "Alagoas e Sergipe", sedeuf: "AL" }],
    },
    localizacoesPorDsei([CASAI, linha(), LOTACAO, SEDE]),
  ) as { dsei: DseiDoMapa[] };
  const dsei = lmap.dsei[0]!;
  const cnes = (
    codigo: string,
    nome: string,
    lat: number,
    lon: number,
  ): EstabelecimentoCompacto => [nome, codigo, lat, lon, "OUTRO NOME", "SE"];

  it("CASAI do SIGEPSI é CASAI; lotação não conta como polo base", () => {
    const registros = registrosDoDsei(dsei, { rede: {}, nac: [] });
    expect(registros.map((r) => [r.name, r.type.key, r.uf])).toEqual([
      ["CASAI DSEI AL/SE", "casai", "AL"],
      ["PB ACONÃ", "polo", "AL"],
      ["NOVO DIA", "unit", "AL"],
    ]);
    expect(resumoDaRede(dsei, registros)[0]).toBe("Polos base: 1");
  });

  it("repetido no CNES: um ponto só, com nome, posição, município e UF do SIGEPSI", () => {
    const registros = registrosDoDsei(dsei, {
      rede: {
        [dsei.k]: {
          u: [
            cnes("1", "UBSI NOVO DIA", -10.3, -36.9),
            cnes("2", "POLO BASE ACONA", -9.98, -37.01),
            // Só no CNES: continua no mapa.
            cnes("3", "UBSI MATA DA CAFURNA", -9.5, -36.6),
          ],
          // Mesmo lugar, nenhuma palavra em comum: o SIGEPSI prevalece.
          c: [cnes("4", "CASAI ALAGOAS", -9.62718, -35.73629)],
        },
      },
      nac: [],
    });
    expect(
      registros.map((r) => [r.name, r.type.key, r.lat, r.city, r.uf, r.cnes]),
    ).toEqual([
      ["PB ACONÃ", "polo", -9.971, "TRAIPU", "AL", "2"],
      ["NOVO DIA", "ubsi", -10.1, "PORTO REAL DO COLEGIO", "AL", "1"],
      ["CASAI DSEI AL/SE", "casai", -9.62718, "MACEIO", "AL", ""],
      ["UBSI MATA DA CAFURNA", "ubsi", -9.5, "OUTRO NOME", "SE", "3"],
    ]);
  });

  it("o editor não oferece a sede nem os pontos do SIGEPSI", () => {
    expect(pontosEditaveisDoMapa({ dsei: [dsei] }, null, dsei.k)).toEqual([]);
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
        : new Response(JSON.stringify([CASAI]), { status: 200 }),
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

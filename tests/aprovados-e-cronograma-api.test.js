import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rotaDosAprovados from "../api/aprovados.js";
import rotaDoCronograma from "../api/cronograma.js";
import {
  aprovadoDaApi,
  etapaDaApi,
  respostaDoCronograma,
  respostaDosAprovados,
} from "../src/lib/aprovados-e-cronograma-da-api.js";
import { RPC_DOS_EDITAIS } from "../src/lib/editais-da-api.js";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  GET /api/aprovados e GET /api/cronograma (para outro sistema, sem login, pela
  chave fixa de /api/editais) e a migration 20261105150000 das duas leituras.
*/

const APROVADOS = [
  {
    edital_id: "e1",
    edital: "001/2026",
    unidade: "DSEI Yanomami",
    cargo: "Enfermeiro",
    classificacao: 1,
    nota: "87,5",
    nome: "Maria da Silva",
    modalidade: "Ampla concorrência",
    status: "Contratado",
    matricula: 12345,
    processo_sei: "25000.000000/2026-00",
    codigo_vaga: "ENF-01",
    sub_judice: false,
  },
  {
    edital_id: "e2",
    edital: "002/2026",
    unidade: "DSEI Alto Rio Negro",
    cargo: "Médico",
    classificacao: null,
    nota: null,
    nome: "João Souza",
    modalidade: "Pessoa com deficiência",
    status: null,
    matricula: null,
    processo_sei: null,
    codigo_vaga: null,
    sub_judice: true,
  },
];

const ETAPAS = [
  {
    edital_id: "e1",
    edital: "001/2026",
    unidade: "DSEI Yanomami",
    ordem: 1,
    atividade: "Publicação do edital",
    data_inicio: "2026-03-02",
    data_fim: "2026-03-02T00:00:00",
  },
  {
    edital_id: "e2",
    edital: "002/2026",
    unidade: "DSEI Alto Rio Negro",
    ordem: 2,
    atividade: "Análise curricular",
    data_inicio: null,
    data_fim: "",
  },
];

describe("formato dos aprovados", () => {
  it("todos os campos combinados, com números, nulos e booleano", () => {
    expect(aprovadoDaApi(APROVADOS[0])).toEqual({
      edital_id: "e1",
      edital: "001/2026",
      unidade: "DSEI Yanomami",
      cargo: "Enfermeiro",
      classificacao: 1,
      nota: 87.5,
      nome: "Maria da Silva",
      modalidade: "Ampla concorrência",
      status: "Contratado",
      matricula: "12345",
      processo_sei: "25000.000000/2026-00",
      codigo_vaga: "ENF-01",
      sub_judice: false,
    });
    const vazio = aprovadoDaApi(APROVADOS[1]);
    expect(vazio.classificacao).toBeNull();
    expect(vazio.nota).toBeNull();
    expect(vazio.status).toBe("");
    expect(vazio.sub_judice).toBe(true);
  });

  it("filtra por igual (sem caixa nem acento) e por trecho", () => {
    const ids = (query) =>
      respostaDosAprovados({ linhas: APROVADOS }, query).aprovados.map(
        (a) => a.edital_id,
      );
    expect(ids({})).toEqual(["e1", "e2"]);
    expect(ids({ status: "contratado" })).toEqual(["e1"]);
    expect(ids({ modalidade: "pessoa com deficiencia" })).toEqual(["e2"]);
    expect(ids({ edital_id: "E2" })).toEqual(["e2"]);
    expect(ids({ nome: "silva" })).toEqual(["e1"]);
    expect(ids({ cargo: "medico", unidade: "rio negro" })).toEqual(["e2"]);
    expect(ids({ status: "contrat" })).toEqual([]);
    expect(respostaDosAprovados(null, {})).toEqual({
      aprovados: [],
      totais: { linhas: 0 },
    });
  });
});

describe("formato do cronograma", () => {
  it("datas em AAAA-MM-DD ou null, ordem numérica", () => {
    expect(etapaDaApi(ETAPAS[0])).toEqual({
      edital_id: "e1",
      edital: "001/2026",
      unidade: "DSEI Yanomami",
      ordem: 1,
      atividade: "Publicação do edital",
      data_inicio: "2026-03-02",
      data_fim: "2026-03-02",
    });
    expect(etapaDaApi(ETAPAS[1]).data_inicio).toBeNull();
    expect(etapaDaApi(ETAPAS[1]).data_fim).toBeNull();
  });

  it("filtra por edital_id, unidade e atividade", () => {
    const ids = (query) =>
      respostaDoCronograma({ linhas: ETAPAS }, query).etapas.map(
        (e) => e.edital_id,
      );
    expect(ids({ edital_id: "e1" })).toEqual(["e1"]);
    expect(ids({ atividade: "analise" })).toEqual(["e2"]);
    expect(respostaDoCronograma({ linhas: ETAPAS }, {}).totais).toEqual({
      linhas: 2,
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
const CHAVE = "chave-da-api-combinada";
const pedido = (chave = CHAVE, query = {}) => ({
  method: "GET",
  headers: { authorization: `Bearer ${chave}` },
  query,
});

describe.each([
  ["aprovados", rotaDosAprovados, "listar_aprovados_da_api", APROVADOS],
  ["cronograma", rotaDoCronograma, "listar_cronograma_da_api", ETAPAS],
])("GET /api/%s", (nome, rota, rpc, linhas) => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_servidor");
    vi.stubEnv("EDITAIS_API_CHAVE", CHAVE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("chave errada: 401 sem chamar o banco", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    const res = respostaFalsa();
    await rota(pedido("outra"), res);
    expect(res.statusCode).toBe(401);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("chave certa: lê a RPC própria com a chave de servidor", async () => {
    const fetchFalso = vi.fn(async () => ({
      ok: true,
      json: async () => ({ linhas }),
    }));
    vi.stubGlobal("fetch", fetchFalso);
    const res = respostaFalsa();
    await rota(pedido(), res);
    expect(res.statusCode).toBe(200);
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toBe(`https://exemplo.supabase.co/rest/v1/rpc/${rpc}`);
    expect(opcoes.headers.apikey).toBe("sb_secret_servidor");
    expect(JSON.stringify(opcoes)).not.toContain(CHAVE);
    const corpo = JSON.parse(res.corpo);
    expect(corpo.totais).toEqual({ linhas: 2 });
    expect(corpo[nome === "aprovados" ? "aprovados" : "etapas"]).toHaveLength(
      2,
    );
  });

  it("falha do banco: 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    const res = respostaFalsa();
    await rota(pedido(), res);
    expect(res.statusCode).toBe(502);
  });
});

describe("migration 20261105170000 (leitura da API de editais)", () => {
  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const NOME = "20261105170000_leitura_da_api_de_editais.sql";
  const MIGRATION = ler(`supabase/migrations/${NOME}`);
  const ENSAIO = ler(`supabase/ensaios/${NOME}`);
  const ROLLBACK = ler(`supabase/rollback/${NOME}`);

  it("só service_role, security definer, só as linhas ativas e os campos que a API lê", () => {
    expect(MIGRATION).toContain("security definer");
    expect(MIGRATION).toContain("set search_path to ''");
    expect(MIGRATION).toContain("where v.ativo is true");
    expect(MIGRATION).toContain(
      "revoke all on function public.listar_editais_da_api() from public, anon, authenticated;\ngrant execute on function public.listar_editais_da_api() to service_role;",
    );
    const campos = [...MIGRATION.matchAll(/^\s+'(\w+)', v\./gm)].map(
      (m) => m[1],
    );
    expect(campos).toEqual([
      "id",
      "unidade",
      "edital",
      "status",
      "etapa",
      "vagas_total",
      "contratados",
      "vagas_ociosas",
      "risco",
      "link_edital",
    ]);
    expect(CONTRATO_RPC.listar_editais_da_api.argumentos).toEqual([]);
    expect(RPC_DOS_EDITAIS).toBe("listar_editais_da_api");
    expect(ROLLBACK).toContain(
      "drop function if exists public.listar_editais_da_api();",
    );
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).toContain(
      MIGRATION.slice(
        MIGRATION.indexOf("\nbegin;\n") + 8,
        MIGRATION.lastIndexOf("\ncommit;"),
      ),
    );
  });
});

describe("migration 20261105150000 (leituras da API)", () => {
  const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
  const NOME = "20261105150000_leituras_da_api_de_aprovados_e_cronograma.sql";
  const MIGRATION = ler(`supabase/migrations/${NOME}`);
  const ROLLBACK = ler(`supabase/rollback/${NOME}`);
  const ENSAIO = ler(`supabase/ensaios/${NOME}`);
  const corpo = (texto) =>
    texto.slice(
      texto.indexOf("\nbegin;\n") + 8,
      texto.lastIndexOf("\ncommit;"),
    );
  const funcao = (nome) => {
    const inicio = MIGRATION.indexOf(`create function public.${nome}()`);
    return MIGRATION.slice(inicio, MIGRATION.indexOf("$function$;", inicio));
  };

  it.each(["listar_aprovados_da_api", "listar_cronograma_da_api"])(
    "%s: só service_role, security definer, search_path vazio, no contrato",
    (nome) => {
      expect(funcao(nome)).toContain("security definer");
      expect(funcao(nome)).toContain("set search_path to ''");
      expect(MIGRATION).toContain(
        `revoke all on function public.${nome}() from public, anon, authenticated;\ngrant execute on function public.${nome}() to service_role;`,
      );
      expect(CONTRATO_RPC[nome].argumentos).toEqual([]);
      expect(ROLLBACK).toContain(`drop function if exists public.${nome}();`);
    },
  );

  it("as leituras devolvem exatamente os campos que a API formata", () => {
    const campos = (nome) =>
      [...funcao(nome).matchAll(/^\s+'(\w+)', [mc]\./gm)].map((m) => m[1]);
    expect(campos("listar_aprovados_da_api")).toEqual(
      Object.keys(aprovadoDaApi({})),
    );
    expect(campos("listar_cronograma_da_api")).toEqual(
      Object.keys(etapaDaApi({})),
    );
  });

  it("só lista vigente, edital ativo e candidato não removido", () => {
    const aprovados = funcao("listar_aprovados_da_api");
    expect(aprovados).toContain("l.vigente is true");
    expect(aprovados).toContain("m.ativo is true");
    expect(aprovados).toContain("c.removido_em is null");
    expect(funcao("listar_cronograma_da_api")).toContain("m.ativo is true");
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });
});

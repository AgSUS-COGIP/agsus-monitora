import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rotaDosAprovados from "../api/aprovados.ts";
import rotaDoCronograma from "../api/cronograma.ts";
import {
  aprovadoDaApi,
  etapaDaApi,
  respostaDoCronograma,
  respostaDosAprovados,
} from "../src/lib/aprovados-e-cronograma-da-api.ts";
import { RPC_DOS_EDITAIS } from "../src/lib/editais-da-api.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";

/*
  GET /api/aprovados e GET /api/cronograma (para outro sistema, sem login, pela
  chave fixa de /api/editais) e a migration 20261105150000 das duas leituras.
*/

const APROVADOS = [
  {
    edital_id: "e1",
    edital: "001/2026",
    unidade: "DSEI Yanomami",
    area: "Saúde Indígena",
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
    area: "SEDE",
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
    area: "Saúde Indígena",
    ordem: 1,
    atividade: "Publicação do edital",
    data_inicio: "2026-03-02",
    data_fim: "2026-03-02T00:00:00",
  },
  {
    edital_id: "e2",
    edital: "002/2026",
    unidade: "DSEI Alto Rio Negro",
    area: "SEDE",
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
      area: "Saúde Indígena",
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
      area: "Saúde Indígena",
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

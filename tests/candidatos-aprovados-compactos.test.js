import { describe, expect, it } from "vitest";
import {
  LISTA_DE_APROVADOS,
  expandirCandidatosCompactos,
  pacoteInalterado,
} from "../src/lib/candidatos-aprovados-compactos.js";
import { criarCacheDePayload } from "../src/lib/cache-de-payload.js";
import {
  compactarCandidatos,
  compactarPorArea,
} from "./componentes/candidatos-compactos-falsos.js";

/* Candidatos no formato de sempre, com repetição e nulos nos campos de dicionário. */
const CANDIDATOS = [
  {
    candidato_id: "a",
    lista_id: "L1",
    cargo: "Enfermeiro",
    classificacao: 1,
    nota: 90.5,
    nome: "Ana",
    modalidade: "Ampla concorrência",
    status: "Contratado",
    processo_sei: "25000.1/2026",
    matricula: "M-1",
    sub_judice: false,
    codigo_vaga: "VG-1",
    edital_id: "7",
    edital: "53/2025",
    unidade: "CASAI São Paulo",
    lista_ativa: true,
    arquivo_nome: "lista.xlsx",
    importado_em: "2026-09-01T10:00:00+00:00",
  },
  {
    candidato_id: "b",
    lista_id: "L2",
    cargo: "Médico",
    classificacao: null,
    nota: 70,
    nome: "Bruno",
    modalidade: null,
    status: null,
    processo_sei: null,
    matricula: null,
    sub_judice: true,
    codigo_vaga: null,
    edital_id: "8",
    edital: "54/2025",
    unidade: "DSEI Manaus",
    lista_ativa: false,
    arquivo_nome: null,
    importado_em: null,
  },
  {
    candidato_id: "c",
    lista_id: "L1",
    cargo: "Enfermeiro",
    classificacao: 2,
    nota: 88,
    nome: "Carla",
    modalidade: "Ampla concorrência",
    status: null,
    processo_sei: null,
    matricula: null,
    sub_judice: false,
    codigo_vaga: "VG-1",
    edital_id: "7",
    edital: "53/2025",
    unidade: "CASAI São Paulo",
    lista_ativa: true,
    arquivo_nome: "lista.xlsx",
    importado_em: "2026-09-01T10:00:00+00:00",
  },
];

describe("lista de aprovados numa chamada só", () => {
  it("volta ao formato de sempre, com os dados da lista em cada candidato", () => {
    const pacote = {
      colunas_da_lista: ["edital_id", "edital", "unidade", "lista_ativa"],
      listas: { L1: ["7", "53/2025", "CASAI São Paulo", true] },
      colunas: ["candidato_id", "lista_id", "nome", "sub_judice"],
      linhas: [
        ["a", "L1", "Ana", false],
        ["b", "L1", "Bruno", true],
      ],
    };
    expect(expandirCandidatosCompactos(pacote)).toEqual([
      {
        candidato_id: "a",
        lista_id: "L1",
        nome: "Ana",
        sub_judice: false,
        edital_id: "7",
        edital: "53/2025",
        unidade: "CASAI São Paulo",
        lista_ativa: true,
      },
      {
        candidato_id: "b",
        lista_id: "L1",
        nome: "Bruno",
        sub_judice: true,
        edital_id: "7",
        edital: "53/2025",
        unidade: "CASAI São Paulo",
        lista_ativa: true,
      },
    ]);
  });

  it("pacote vazio ou quebrado vira lista vazia", () => {
    expect(expandirCandidatosCompactos(null)).toEqual([]);
    expect(expandirCandidatosCompactos({ linhas: "x" })).toEqual([]);
  });

  it("lista ausente deixa os campos da lista nulos", () => {
    const [c] = expandirCandidatosCompactos({
      colunas_da_lista: ["edital"],
      listas: {},
      colunas: ["candidato_id", "lista_id"],
      linhas: [["a", "L9"]],
    });
    expect(c.edital).toBeNull();
  });
});

describe("formato 2: por área, com dicionário", () => {
  it("remonta objetos idênticos aos do formato 1, com as chaves na mesma ordem", () => {
    const antes = expandirCandidatosCompactos(compactarCandidatos(CANDIDATOS));
    const depois = expandirCandidatosCompactos(compactarPorArea(CANDIDATOS));
    expect(depois).toEqual(antes);
    expect(depois).toEqual(CANDIDATOS.map((c) => ({ ...c })));
    depois.forEach((candidato, i) =>
      expect(Object.keys(candidato)).toEqual(Object.keys(antes[i])),
    );
  });

  it("cargo e código da vaga repetidos vão uma vez só", () => {
    const pacote = compactarPorArea(CANDIDATOS);
    expect(pacote.dicionarios.cargo).toEqual(["Enfermeiro", "Médico"]);
    expect(pacote.dicionarios.codigo_vaga).toEqual(["VG-1"]);
    expect(pacote.linhas[1][11]).toBeNull();
    expect(pacote.listas).toHaveLength(2);
  });

  it("índice fora do dicionário vira nulo, sem quebrar", () => {
    const pacote = compactarPorArea(CANDIDATOS);
    pacote.linhas[0][2] = 99;
    expect(expandirCandidatosCompactos(pacote)[0].cargo).toBeNull();
  });

  it("reconhece a resposta de versão que continua valendo", () => {
    expect(
      pacoteInalterado({ formato: 2, versao: "v1", inalterado: true }),
    ).toBe(true);
    expect(pacoteInalterado(compactarPorArea(CANDIDATOS))).toBe(false);
    expect(pacoteInalterado(null)).toBe(false);
  });
});

describe("cópia da lista de aprovados no navegador", () => {
  function armazenamentoEmMemoria() {
    const dados = new Map();
    return {
      dados,
      ler: async (chave) => structuredClone(dados.get(chave) ?? null),
      guardar: async (chave, valor) => {
        dados.set(chave, structuredClone(valor));
      },
      apagarTudo: async () => dados.clear(),
    };
  }

  it("guarda uma cópia por usuário e área, só do formato 2", async () => {
    const armazenamento = armazenamentoEmMemoria();
    const cache = criarCacheDePayload({
      armazenamento,
      versao: "pub-1",
      tipo: LISTA_DE_APROVADOS,
    });
    const sede = compactarPorArea(CANDIDATOS, { area: "sede", versao: "x" });
    expect(await cache.guardar({ usuarioId: "u1", area: "sede" }, sede)).toBe(
      true,
    );
    expect(await cache.ler({ usuarioId: "u1", area: "sede" })).toEqual(sede);
    expect(await cache.ler({ usuarioId: "u1", area: "projetos" })).toBeNull();
    expect(armazenamento.dados.has("aprovados:sede")).toBe(true);
    // O formato 1 (todas as áreas, sem versão) não é guardado.
    expect(
      await cache.guardar(
        { usuarioId: "u1", area: "sede" },
        compactarCandidatos(CANDIDATOS),
      ),
    ).toBe(false);
  });

  it("outro usuário apaga as cópias de quem veio antes", async () => {
    const armazenamento = armazenamentoEmMemoria();
    const cache = criarCacheDePayload({
      armazenamento,
      versao: "pub-1",
      tipo: LISTA_DE_APROVADOS,
    });
    await cache.guardar(
      { usuarioId: "u1", area: "sede" },
      compactarPorArea(CANDIDATOS),
    );
    expect(await cache.ler({ usuarioId: "u2", area: "sede" })).toBeNull();
    expect(await cache.ler({ usuarioId: "u1", area: "sede" })).toBeNull();
  });
});
